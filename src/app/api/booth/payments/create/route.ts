// src/app/api/booth/payments/create/route.ts
import { NextResponse } from "next/server";
import { PaymentDirection, PaymentMethod, PaymentOrigin, RoleName } from "@prisma/client";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { findCurrentShiftSession } from "@/lib/shiftSessions";
import { syncChannelCommissionLineFromPaymentTx } from "@/lib/channel-commission-lines";

const BodySchema = z.object({
  reservationId: z.string().min(1),
  amountCents: z.number().int().positive(),
  method: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]).default("CASH"),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  await assertCashOpenForUser(session.userId, session.role as RoleName, session.shiftSessionId);

  const { reservationId, amountCents, method } = parsed.data;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      source: true,
      totalPriceCents: true,
      commissionBaseCents: true,
      appliedCommissionPct: true,
      appliedCommissionMode: true,
      appliedCommissionValue: true,
      appliedCommissionCents: true,
      customerDiscountMode: true,
      customerDiscountValue: true,
      customerDiscountCents: true,
      manualDiscountCents: true,
      autoDiscountCents: true,
      discountResponsibility: true,
      promoterDiscountShareBps: true,
      promoterDiscountCents: true,
      companyDiscountCents: true,
      customerName: true,
    },
  });

  if (!reservation) return NextResponse.json({ error: "Reserva no existe" }, { status: 404 });
  if (reservation.source !== "BOOTH") {
    return NextResponse.json({ error: "Solo se puede cobrar en reservas de carpa" }, { status: 400 });
  }

  const boothPayments = await prisma.payment.findMany({
    where: {
      reservationId,
      origin: PaymentOrigin.BOOTH,
      isDeposit: false,
    },
    select: {
      amountCents: true,
      direction: true,
    },
  });

  const paidSoFar = boothPayments.reduce(
    (sum, payment) =>
      sum +
      (payment.direction === PaymentDirection.OUT
        ? -Number(payment.amountCents ?? 0)
        : Number(payment.amountCents ?? 0)),
    0
  );
  const pending = Math.max(0, reservation.totalPriceCents - paidSoFar);

  if (amountCents > pending) {
    return NextResponse.json(
      { error: `Importe supera lo pendiente. Pendiente: ${pending} centimos` },
      { status: 400 }
    );
  }

  const shiftSession = await findCurrentShiftSession({
    userId: session.userId,
    role: RoleName.BOOTH,
    shiftSessionId: session.shiftSessionId,
  });

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        reservationId,
        origin: PaymentOrigin.BOOTH,
        method: method as PaymentMethod,
        amountCents,
        commissionBaseCents: reservation.commissionBaseCents ?? 0,
        appliedCommissionPct: reservation.appliedCommissionPct ?? null,
        appliedCommissionMode: reservation.appliedCommissionMode ?? "PERCENT",
        appliedCommissionValue: reservation.appliedCommissionValue ?? 0,
        appliedCommissionCents: reservation.appliedCommissionCents ?? 0,
        customerDiscountMode: reservation.customerDiscountMode ?? "PERCENT",
        customerDiscountValue: reservation.customerDiscountValue ?? 0,
        customerDiscountCents: reservation.customerDiscountCents ?? 0,
        externalDiscountCents:
          (reservation.customerDiscountCents ?? 0) +
          (reservation.manualDiscountCents ?? 0) +
          (reservation.autoDiscountCents ?? 0),
        discountResponsibility: reservation.discountResponsibility ?? "COMPANY",
        promoterDiscountShareBps: reservation.promoterDiscountShareBps ?? 0,
        promoterDiscountCents: reservation.promoterDiscountCents ?? 0,
        companyDiscountCents: reservation.companyDiscountCents ?? 0,
        isDeposit: false,
        direction: PaymentDirection.IN,
        customerName: reservation.customerName ?? null,
        createdByUserId: session.userId,
        shiftSessionId: shiftSession?.id ?? null,
      },
      select: { id: true },
    });
    await syncChannelCommissionLineFromPaymentTx(tx, created.id);
    return created;
  });

  return NextResponse.json({ ok: true, paymentId: payment.id, paidNowCents: amountCents });
}
