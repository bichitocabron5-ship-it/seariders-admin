// src/app/api/store/calendar/month/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { BUSINESS_TZ, tzLocalToUtcDate, todayYmdInTz } from "@/lib/tz-business";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "STORE" || session.role === "ADMIN") return session;
  return null;
}

function startEndOfMonthInTz(ym: string) {
  const [y, m] = ym.split("-").map(Number);

  const tz = BUSINESS_TZ;

  // inicio mes en Madrid => Date UTC correcto
  const start = tzLocalToUtcDate(tz, y, m, 1, 0, 0);

  // fin exclusivo: primer día del mes siguiente a las 00:00 Madrid
  const endExclusive =
    m === 12
      ? tzLocalToUtcDate(tz, y + 1, 1, 1, 0, 0)
      : tzLocalToUtcDate(tz, y, m + 1, 1, 0, 0);

  return { start, endExclusive };
}

function dayKeyMadridFromUtcDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function GET(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || todayYmdInTz(BUSINESS_TZ).slice(0, 7);

  const { start, endExclusive } = startEndOfMonthInTz(month);

  // 1) Reservas del mes (SOLO STORE)
  const reservations = await prisma.reservation.findMany({
    where: {
      source: "STORE",
      // usamos scheduledTime si existe, si no activityDate (lo resolvemos luego)
      OR: [
        { scheduledTime: { gte: start, lt: endExclusive } },
        { scheduledTime: null, activityDate: { gte: start, lt: endExclusive } },
      ],

    },
    select: {
      id: true,
      status: true,
      activityDate: true,
      scheduledTime: true,
      customerName: true,
      formalizedAt: true,
      totalPriceCents: true, // servicio final
      depositCents: true,     // fianza
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true, paxMax: true } },
    },
  });

  const ids = reservations.map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, month, days: {}, totalCount: 0 });
  }

  // 2) Pagos agrupados por reserva (neto IN/OUT) + separar fianza/servicio
  const payments = await prisma.payment.findMany({
    where: {
      reservationId: { in: ids, not: null }, // Prisma a veces se pone tiquismiquis con tipos aquí
    },
    select: { reservationId: true, amountCents: true, direction: true, isDeposit: true },
  });

  const payByRes: Record<string, { serviceNet: number; depositNet: number }> = {};

  for (const p of payments) {
    const rid = p.reservationId;
    if (!rid) continue; // evita null

    const sign = p.direction === "OUT" ? -1 : 1;

    payByRes[rid] ??= { serviceNet: 0, depositNet: 0 };
    if (p.isDeposit) payByRes[rid].depositNet += sign * p.amountCents;
    else payByRes[rid].serviceNet += sign * p.amountCents;
  }

  // 3) Construir days (para tu grid mensual)
  type MonthRow = {
    id: string;
    status: string;
    activityDate: Date;
    scheduledTime: Date | null;
    formalizedAt: Date | null;
    customerName: string | null;
    totalCents: number;
    pendingCents: number;
    paidCents: number;
    service: { name: string; category: string | null } | null;
    option: { durationMinutes: number; paxMax: number } | null;
  };
  const days: Record<string, { count: number; rows: MonthRow[] }> = {};

  for (const r of reservations) {
    const when = new Date(r.scheduledTime ?? r.activityDate);
    const k = dayKeyMadridFromUtcDate(when);

    const paid = payByRes[r.id] ?? { serviceNet: 0, depositNet: 0 };

    const serviceDue = Number(r.totalPriceCents ?? 0);
    const depositDue = Number(r.depositCents ?? 0);

    const pendingServiceCents = Math.max(0, serviceDue - paid.serviceNet);
    const pendingDepositCents = Math.max(0, depositDue - paid.depositNet);
    const pendingCents = pendingServiceCents + pendingDepositCents;
    const paidCents = Math.max(0, paid.serviceNet + paid.depositNet);

    const totalCents = serviceDue; // y la fianza ya la tienes en depositDue si quieres mostrarla luego

    days[k] ??= { count: 0, rows: [] };
    days[k].rows.push({
      id: r.id,
      status: r.status,
      activityDate: r.activityDate,
      scheduledTime: r.scheduledTime,
      formalizedAt: r.formalizedAt,
      customerName: r.customerName,
      totalCents,
      pendingCents,
      paidCents,
      service: r.service,
      option: r.option,
    });
    days[k].count += 1;
  }

  // (opcional) ordenar cada día por hora
  for (const k of Object.keys(days)) {
    days[k].rows.sort((a, b) => {
      const da = new Date(a.scheduledTime ?? a.activityDate).getTime();
      const db = new Date(b.scheduledTime ?? b.activityDate).getTime();
      return da - db;
    });
    // si quieres recortar a 6 para la celda:
    // days[k].rows = days[k].rows.slice(0, 6);
  }

  return NextResponse.json({ ok: true, month, days, totalCount: reservations.length });
}

