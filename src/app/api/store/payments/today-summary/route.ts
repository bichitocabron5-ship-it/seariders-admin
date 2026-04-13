// src/app/api/store/payments/today-summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TZ, tzDayRangeUtc, utcDateFromYmdInTz, todayYmdInTz } from "@/lib/tz-business";
import { PaymentOrigin } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const Query = z.object({
  origin: z.nativeEnum(PaymentOrigin).optional(),
  date: z.string().min(10).max(10).optional(),
});

function dayRangeFromYmd(ymd: string) {
  const start = utcDateFromYmdInTz(BUSINESS_TZ, ymd);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextYmd = todayYmdInTz(BUSINESS_TZ, next);
  const endExclusive = utcDateFromYmdInTz(BUSINESS_TZ, nextYmd);
  return { start, endExclusive };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      origin: url.searchParams.get("origin") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const { start, endExclusive } = parsed.data.date
      ? dayRangeFromYmd(parsed.data.date)
      : tzDayRangeUtc(BUSINESS_TZ);

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: start, lt: endExclusive },
        ...(parsed.data.origin ? { origin: parsed.data.origin } : {}),
      },
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

