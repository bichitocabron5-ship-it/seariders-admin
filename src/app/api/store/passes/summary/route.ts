// src/app/api/store/passes/summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { getPassVoucherPaidCents, getPassVoucherPendingCents } from "@/lib/pass-vouchers";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

function getYmdInTz(date: Date, tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yy, mm, dd] = fmt.format(date).split("-").map(Number);
  return { y: yy, m: mm, d: dd };
}

function addDaysYmd(y: number, m: number, d: number, days: number) {
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return Math.round((asUtc - date.getTime()) / 60_000);
}

function zonedTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, ss: number, tz: string): Date {
  let utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  for (let i = 0; i < 2; i++) {
    const offsetMin = tzOffsetMinutes(utcGuess, tz);
    utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - offsetMin * 60_000);
  }
  return utcGuess;
}

function tzDayRangeUtc(tz: string, date: Date) {
  const ymd = getYmdInTz(date, tz);
  const start = zonedTimeToUtc(ymd.y, ymd.m, ymd.d, 0, 0, 0, tz);
  const next = addDaysYmd(ymd.y, ymd.m, ymd.d, 1);
  const endExclusive = zonedTimeToUtc(next.y, next.m, next.d, 0, 0, 0, tz);
  return { start, endExclusive };
}

export async function GET() {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const tz = process.env.BUSINESS_TZ || "Europe/Madrid";
  const { start, endExclusive } = tzDayRangeUtc(tz, new Date());

  // Pendientes: activos, no caducados, con minutos
  const pending = await prisma.passVoucher.findMany({
    where: {
      isVoided: false,
      minutesRemaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ soldAt: "desc" }],
    take: 60,
    select: {
      id: true,
      code: true,
      soldAt: true,
      expiresAt: true,
      salePriceCents: true,
      minutesTotal: true,
      minutesRemaining: true,
      buyerName: true,
      buyerPhone: true,
      buyerEmail: true,
      soldPayment: { select: { amountCents: true, direction: true } },
      salePayments: { select: { amountCents: true, direction: true } },
      product: { select: { name: true } },
    },
  });

  // Vendidos hoy (store)
  const soldToday = await prisma.passVoucher.findMany({
    where: {
      origin: "STORE",
      soldAt: { gte: start, lt: endExclusive },
    },
    orderBy: [{ soldAt: "desc" }],
    take: 60,
    select: {
      id: true,
      code: true,
      soldAt: true,
      expiresAt: true,
      salePriceCents: true,
      minutesTotal: true,
      minutesRemaining: true,
      buyerName: true,
      buyerPhone: true,
      buyerEmail: true,
      soldPayment: { select: { amountCents: true, direction: true } },
      salePayments: { select: { amountCents: true, direction: true } },
      product: { select: { name: true } },
    },
  });

  const enrich = <
    T extends {
      salePriceCents: number;
      soldPayment?: { amountCents: number; direction: "IN" | "OUT" } | null;
      salePayments?: Array<{ amountCents: number; direction: "IN" | "OUT" }> | null;
    },
  >(rows: T[]) =>
    rows.map((row) => {
      const paidCents = getPassVoucherPaidCents(row);
      return {
        ...row,
        paidCents,
        pendingCents: getPassVoucherPendingCents(row.salePriceCents, paidCents),
      };
    });

  return NextResponse.json({ ok: true, pending: enrich(pending), soldToday: enrich(soldToday) });
}
