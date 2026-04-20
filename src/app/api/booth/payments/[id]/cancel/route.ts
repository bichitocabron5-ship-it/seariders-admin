import { NextResponse } from "next/server";
import { PaymentDirection, RoleName } from "@prisma/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { type AppSession, sessionOptions } from "@/lib/session";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { findCurrentShiftSession } from "@/lib/shiftSessions";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await assertCashOpenForUser(session.userId, session.role as RoleName, session.shiftSessionId);

  const payment = await prisma.payment.findUnique({
    where: { id },
    select: {
      id: true,
      reservationId: true,
      origin: true,
      method: true,
      amountCents: true,
      isDeposit: true,
      direction: true,
      createdAt: true,
      createdByUserId: true,
      customerName: true,
      description: true,
      notes: true,
      serviceId: true,
      channelId: true,
      isExternalCommissionOnly: true,
      externalGrossAmountCents: true,
      reversalOfPaymentId: true,
      reversals: {
        select: {
          id: true,
          amountCents: true,
          direction: true,
        },
      },
    },
  });

  if (!payment || payment.origin !== "BOOTH" || payment.reservationId || !payment.serviceId || !payment.channelId) {
    return NextResponse.json({ error: "Cobro externo no encontrado" }, { status: 404 });
  }

  if (!payment.isExternalCommissionOnly || payment.reversalOfPaymentId) {
    return NextResponse.json({ error: "Solo se pueden anular cobros externos directos originales" }, { status: 400 });
  }

  const netAfterReversals =
    Math.abs(Number(payment.amountCents ?? 0)) +
    payment.reversals.reduce(
      (sum, reversal) => sum + (reversal.direction === "OUT" ? -Math.abs(Number(reversal.amountCents ?? 0)) : Math.abs(Number(reversal.amountCents ?? 0))),
      0
    );

  if (netAfterReversals <= 0) {
    return NextResponse.json({ error: "Este cobro ya está anulado" }, { status: 400 });
  }

  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);
  if (payment.createdAt < start || payment.createdAt >= endExclusive) {
    return NextResponse.json(
      { error: "Solo se pueden anular cobros externos del día operativo actual" },
      { status: 400 }
    );
  }

  const shiftSession = await findCurrentShiftSession({
    userId: session.userId,
    role: RoleName.BOOTH,
    shift: session.shift ?? "MORNING",
    shiftSessionId: session.shiftSessionId,
  });
  if (!shiftSession && String(session.role) !== "ADMIN") {
    return NextResponse.json({ error: "No hay shift session de carpa válida para esta anulación." }, { status: 400 });
  }

  const reversal = await prisma.payment.create({
    data: {
      origin: payment.origin,
      method: payment.method,
      amountCents: Math.abs(Number(payment.amountCents ?? 0)),
      isExternalCommissionOnly: payment.isExternalCommissionOnly,
      externalGrossAmountCents: payment.externalGrossAmountCents,
      reversalOfPaymentId: payment.id,
      isDeposit: payment.isDeposit,
      direction: PaymentDirection.OUT,
      createdByUserId: session.userId,
      shiftSessionId: shiftSession?.id ?? null,
      serviceId: payment.serviceId,
      channelId: payment.channelId,
      customerName: payment.customerName,
      description: payment.description,
      notes: [payment.notes?.trim(), `ANULACION ${payment.id}`].filter(Boolean).join(" · "),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, reversalPaymentId: reversal.id });
}
