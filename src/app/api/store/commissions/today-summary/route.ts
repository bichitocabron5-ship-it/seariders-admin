// src/app/api/store/commissions/today-summary/route.ts
import { NextResponse } from "next/server";
import { ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveCommissionForReporting } from "@/lib/commission-reporting";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { requireApiRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireApiRole(["STORE", "ADMIN"]);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);

    // 1) Reservas del dia de negocio con canal
    const reservations = await prisma.reservation.findMany({
      where: {
        formalizedAt: { not: null },
        status: { not: ReservationStatus.CANCELED },
        OR: [
          { scheduledTime: { gte: start, lt: endExclusive } },
          { scheduledTime: null, activityDate: { gte: start, lt: endExclusive } },
        ],
        channelId: { not: null },
      },
      select: {
        id: true,
        channelId: true,
        serviceId: true,
        commissionBaseCents: true,
        appliedCommissionMode: true,
        appliedCommissionValue: true,
        appliedCommissionPct: true,
        appliedCommissionCents: true,
        totalPriceCents: true,
        channel: {
          select: {
            id: true,
            name: true,
            kind: true,
            commissionEnabled: true,
            commissionBps: true, // fallback
            commissionPct: true,
            promoterCommissionMode: true,
            promoterCommissionValue: true,
            promoterCommissionCents: true,
            commissionRules: {
              where: { isActive: true },
              select: {
                serviceId: true,
                commissionPct: true,
                promoterCommissionMode: true,
                promoterCommissionValue: true,
                promoterCommissionCents: true,
              },
            },
          },
        },
      },
    });

    const externalPayments = await prisma.payment.findMany({
      where: {
        reservationId: null,
        reversalOfPaymentId: null,
        origin: "BOOTH",
        createdAt: { gte: start, lt: endExclusive },
        channelId: { not: null },
        serviceId: { not: null },
      },
      select: {
        amountCents: true,
        commissionBaseCents: true,
        appliedCommissionMode: true,
        appliedCommissionValue: true,
        appliedCommissionPct: true,
        appliedCommissionCents: true,
        direction: true,
        isExternalCommissionOnly: true,
        externalGrossAmountCents: true,
        channelId: true,
        serviceId: true,
        reversals: {
          select: {
            amountCents: true,
            direction: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            kind: true,
            commissionEnabled: true,
            commissionBps: true,
            commissionPct: true,
            promoterCommissionMode: true,
            promoterCommissionValue: true,
            promoterCommissionCents: true,
            commissionRules: {
              where: { isActive: true },
              select: {
                serviceId: true,
                commissionPct: true,
                promoterCommissionMode: true,
                promoterCommissionValue: true,
                promoterCommissionCents: true,
              },
            },
          },
        },
      },
    });

    if (reservations.length === 0 && externalPayments.length === 0) {
      return NextResponse.json({ count: 0, totalCommissionCents: 0, byChannel: {}, byOrigin: {} });
    }

    let count = 0;
    let totalCommissionCents = 0;
    const byChannel: Record<string, number> = {};
    const byOrigin: Record<string, { totalCommissionCents: number; byChannel: Record<string, number> }> = {};

    function addCommission(origin: "STORE" | "BOOTH", channelName: string, commission: number) {
      totalCommissionCents += commission;
      byChannel[channelName] = (byChannel[channelName] ?? 0) + commission;

      const bucket = byOrigin[origin] ?? { totalCommissionCents: 0, byChannel: {} };
      bucket.totalCommissionCents += commission;
      bucket.byChannel[channelName] = (bucket.byChannel[channelName] ?? 0) + commission;
      byOrigin[origin] = bucket;
    }

    // (Opcional debug)
    // const debug: any[] = [];

    for (const r of reservations) {
      const ch = r.channel;
      if (!ch || !ch.commissionEnabled) continue;
      const resolvedCommission = resolveCommissionForReporting({
        commissionBaseCents: r.commissionBaseCents,
        appliedCommissionMode: r.appliedCommissionMode,
        appliedCommissionValue: r.appliedCommissionValue,
        appliedCommissionPct: r.appliedCommissionPct,
        appliedCommissionCents: r.appliedCommissionCents,
        legacyBaseCents:
          Number(r.commissionBaseCents ?? 0) > 0
            ? Number(r.commissionBaseCents ?? 0)
            : Number(r.totalPriceCents ?? 0),
        channel: ch,
        serviceId: r.serviceId,
      });
      const commission = resolvedCommission.appliedCommissionCents;
      if (commission <= 0) continue;

      count++;
      addCommission("STORE", ch.name, commission);

      // debug.push({ reservationId: r.id, channel: ch.name, commission, source: resolvedCommission.source });
    }

    for (const payment of externalPayments) {
      const ch = payment.channel;
      if (!ch || !payment.serviceId || !ch.commissionEnabled) continue;

      const signedAmount =
        (payment.direction === "OUT" ? -1 : 1) * Math.abs(Number(payment.amountCents ?? 0)) +
        payment.reversals.reduce(
          (sum, reversal) =>
            sum +
            (reversal.direction === "OUT" ? -1 : 1) * Math.abs(Number(reversal.amountCents ?? 0)),
          0
        );

      if (payment.isExternalCommissionOnly) {
        if (signedAmount <= 0) continue;
        count++;
        addCommission("BOOTH", ch.name, signedAmount);
        continue;
      }

      const resolvedCommission = resolveCommissionForReporting({
        commissionBaseCents: payment.commissionBaseCents,
        appliedCommissionMode: payment.appliedCommissionMode,
        appliedCommissionValue: payment.appliedCommissionValue,
        appliedCommissionPct: payment.appliedCommissionPct,
        appliedCommissionCents: payment.appliedCommissionCents,
        legacyBaseCents:
          Number(payment.commissionBaseCents ?? 0) > 0
            ? Number(payment.commissionBaseCents ?? 0)
            : signedAmount,
        channel: ch,
        serviceId: payment.serviceId,
      });
      const commission = resolvedCommission.appliedCommissionCents;
      if (commission <= 0) continue;

      count++;
      addCommission("BOOTH", ch.name, commission);
    }

    return NextResponse.json({
      count,
      totalCommissionCents,
      byChannel,
      byOrigin,
      // debug,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 500 });
  }
}

