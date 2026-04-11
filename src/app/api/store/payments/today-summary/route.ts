// src/app/api/store/payments/today-summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);

    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: start, lt: endExclusive } },
      select: {
        amountCents: true,
        method: true,
        origin: true,
        isDeposit: true,
        direction: true,
        giftVoucherSold: { select: { isVoided: true } },
        passSoldVoucher: { select: { isVoided: true } },
        passVoucherSale: { select: { isVoided: true } },
      },
    });

    const visiblePayments = payments.filter(
      (payment) =>
        !payment.giftVoucherSold?.isVoided &&
        !payment.passSoldVoucher?.isVoided &&
        !payment.passVoucherSale?.isVoided
    );

    const signed = (p: { direction: string; amountCents: number }) =>
      p.direction === "OUT" ? -p.amountCents : p.amountCents;

    // Totales IN/OUT/NET
    const inCents = visiblePayments.filter((p) => p.direction !== "OUT").reduce((s, p) => s + p.amountCents, 0);
    const outCents = visiblePayments.filter((p) => p.direction === "OUT").reduce((s, p) => s + p.amountCents, 0);
    const totalCents = visiblePayments.reduce((s, p) => s + signed(p), 0); // neto

    // Servicio / Fianza (neto)
    const depositCents = visiblePayments.filter((p) => p.isDeposit).reduce((s, p) => s + signed(p), 0);
    const serviceCents = visiblePayments.filter((p) => !p.isDeposit).reduce((s, p) => s + signed(p), 0);

    // Por método/origen: neto + in/out
    const byMethod: Record<string, { netCents: number; inCents: number; outCents: number }> = {};
    const byOrigin: Record<string, { netCents: number; inCents: number; outCents: number }> = {};

    for (const p of visiblePayments) {
      // method
      byMethod[p.method] ??= { netCents: 0, inCents: 0, outCents: 0 };
      byMethod[p.method].netCents += signed(p);
      if (p.direction === "OUT") byMethod[p.method].outCents += p.amountCents;
      else byMethod[p.method].inCents += p.amountCents;

      // origin
      byOrigin[p.origin] ??= { netCents: 0, inCents: 0, outCents: 0 };
      byOrigin[p.origin].netCents += signed(p);
      if (p.direction === "OUT") byOrigin[p.origin].outCents += p.amountCents;
      else byOrigin[p.origin].inCents += p.amountCents;
    }

    return NextResponse.json({
      count: visiblePayments.length,

      // caja global
      inCents,
      outCents,
      totalCents, // neto = in - out

      // desglose neto
      serviceCents,
      depositCents,

      // desglose neto + in/out por agrupación
      byMethod,
      byOrigin,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

