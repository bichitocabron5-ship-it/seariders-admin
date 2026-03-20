// src/app/api/store/cash-closures/summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PaymentOrigin, ShiftName, RoleName } from "@prisma/client";
import { originFromRoleName, sumByMethod, parseBusinessDate, shiftWindow } from "@/lib/cashClosures";

export const runtime = "nodejs";

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin),
  shift: z.nativeEnum(ShiftName).optional(), // MORNING/AFTERNOON
  date: z.string().optional(), // YYYY-MM-DD (si no, hoy)
});

async function requireRoleForOrigin(origin: PaymentOrigin) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;

  if (session.role === "ADMIN") return session;

  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (roleOrigin === origin) return session;

  return null;
}

function emptyByMethod() {
  return { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const parsed = Q.safeParse({
      origin: u.searchParams.get("origin"),
      shift: u.searchParams.get("shift") ?? undefined,
      date: u.searchParams.get("date") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

    const { origin, shift: shiftRaw, date } = parsed.data;

    const session = await requireRoleForOrigin(origin);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Si no viene shift, elegimos uno por defecto (pero mejor mandarlo siempre desde UI)
    const shift: ShiftName = (shiftRaw ?? (session.shift as ShiftName) ?? "MORNING") as ShiftName;
    const businessDate = parseBusinessDate(date);

    const payments = await prisma.payment.findMany({
      where: {
        origin,
        // ✅ el turno lo define la ShiftSession
        shiftSession: {
          is: {
            businessDate,
            shift,
          },
        },
      },
      select: { amountCents: true, isDeposit: true, direction: true, method: true },
      orderBy: { createdAt: "asc" },
    });

    const serviceIn = emptyByMethod();
    const serviceOut = emptyByMethod();
    const depositIn = emptyByMethod();
    const depositOut = emptyByMethod();

    for (const p of payments) {
      const bucket = p.isDeposit
        ? p.direction === "OUT"
          ? depositOut
          : depositIn
        : p.direction === "OUT"
        ? serviceOut
        : serviceIn;

      const m = p.method as keyof typeof serviceIn;
      bucket[m] = (bucket[m] ?? 0) + Number(p.amountCents || 0);
    }

    const net = (ins: Record<string, number>, outs: Record<string, number>) => {
      const res: Record<string, number> = {};
      let total = 0;
      for (const k of Object.keys(emptyByMethod())) {
        res[k] = (ins[k] ?? 0) - (outs[k] ?? 0);
        total += res[k];
      }
      return { byMethod: res, total };
    };

    const systemTotals = sumByMethod(
      payments.map((p) => ({
        amountCents: p.amountCents,
        direction: p.direction,
        method: p.method,
        isDeposit: p.isDeposit,
      }))
    );
    const { from, to } = shiftWindow(origin, businessDate, shift);

    const serviceNet = net(serviceIn, serviceOut);
    const depositNet = net(depositIn, depositOut);

    const computed = {
      service: { IN: serviceIn, OUT: serviceOut, NET: serviceNet },
      deposit: { IN: depositIn, OUT: depositOut, NET: depositNet },
      all: { NET: serviceNet.total + depositNet.total },
      meta: { origin, shift, businessDate, windowFrom: from, windowTo: to },
    };

    // ¿ya está cerrado? (por origin+shift+día)
    const existing = await prisma.cashClosure.findUnique({
      where: {
        businessDate_origin_shift: {
          businessDate,
          origin,
          shift,
        },
      },
      select: { id: true, closedAt: true, isVoided: true },
    });

    const isClosed = Boolean(existing && !existing.isVoided);

    return NextResponse.json({
      ok: true,
      computed,
      systemTotals, // ✅ listo para UI y para close
      isClosed,
      closure: existing ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


