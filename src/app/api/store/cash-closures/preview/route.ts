import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentOrigin, ShiftName, RoleName } from "@prisma/client";
import { originFromRoleName, getClosureWindow, sumByMethod, emptyMethodMap, METHODS, parseBusinessDate } from "@/lib/cashClosures";

export const runtime = "nodejs";

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin),
  shift: z.nativeEnum(ShiftName),
  date: z.string().min(10).max(10), // YYYY-MM-DD
});

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url);
  const parsed = Q.safeParse({
    origin: u.searchParams.get("origin"),
    shift: u.searchParams.get("shift"),
    date: u.searchParams.get("date"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Faltan params: origin, shift, date" }, { status: 400 });

  const origin = parsed.data.origin;
  const shift = parsed.data.shift;
  const businessDate = parseBusinessDate(parsed.data.date);

  // Permisos: el role del user debe mapear al origin, o ADMIN
  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (String(session.role) !== "ADMIN" && roleOrigin !== origin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { from, to } = await getClosureWindow(origin, businessDate, shift);

  const payments = await prisma.payment.findMany({
    where: {
      origin,
      createdAt: { gte: from, lt: to },
    },
    select: {
      amountCents: true,
      direction: true,
      method: true,
      isDeposit: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const system = sumByMethod(payments);

  // “plantilla” de declarado (0)
  const declared = {
    service: emptyMethodMap(),
    deposit: emptyMethodMap(),
    total: emptyMethodMap(),
    netService: 0,
    netDeposit: 0,
    netTotal: 0,
  };

  return NextResponse.json({
    ok: true,
    origin,
    shift,
    businessDate,
    windowFrom: from,
    windowTo: to,
    methods: METHODS,
    system,
    declaredTemplate: declared,
    countPayments: payments.length,
  });
}

