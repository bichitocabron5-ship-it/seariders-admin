// src/app/api/store/commissions/today-summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clampCommissionPct, commissionFromBase, resolveCommissionRate } from "@/lib/commission";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);

    // 1) Reservas del dia de negocio con canal + item principal (isExtra=false)
    const reservations = await prisma.reservation.findMany({
      where: {
        formalizedAt: { not: null },
        OR: [
          { scheduledTime: { gte: start, lt: endExclusive } },
          { scheduledTime: null, activityDate: { gte: start, lt: endExclusive } },
        ],
        channelId: { not: null },
      },
      select: {
        id: true,
        channelId: true,
        channel: {
          select: {
            id: true,
            name: true,
            commissionEnabled: true,
            commissionBps: true, // fallback
            commissionPct: true,
          },
        },
        items: {
          where: { isExtra: false },
          orderBy: { createdAt: "asc" }, // estabilidad
          select: {
            serviceId: true,
            totalPriceCents: true,
            isExtra: true,
          },
          take: 1,
        },
      },
    });

    const channelIds = Array.from(
      new Set(reservations.map((r) => r.channelId).filter(Boolean) as string[])
    );

    const serviceIds = Array.from(
      new Set(reservations.map((r) => r.items?.[0]?.serviceId).filter(Boolean) as string[])
    );

    const externalPayments = await prisma.payment.findMany({
      where: {
        reservationId: null,
        origin: "BOOTH",
        createdAt: { gte: start, lt: endExclusive },
        channelId: { not: null },
        serviceId: { not: null },
      },
      select: {
        amountCents: true,
        direction: true,
        channelId: true,
        serviceId: true,
        channel: {
          select: {
            id: true,
            name: true,
            commissionEnabled: true,
            commissionBps: true,
            commissionPct: true,
            commissionRules: {
              where: { isActive: true },
              select: { serviceId: true, commissionPct: true },
            },
          },
        },
      },
    });

    for (const payment of externalPayments) {
      if (payment.channelId) channelIds.push(payment.channelId);
      if (payment.serviceId) serviceIds.push(payment.serviceId);
    }

    if (channelIds.length === 0 || serviceIds.length === 0) {
      return NextResponse.json({ count: 0, totalCommissionCents: 0, byChannel: {} });
    }

    // 2) Reglas específicas channel+service
    const rules = await prisma.channelCommissionRule.findMany({
      where: {
        isActive: true,
        channelId: { in: channelIds },
        serviceId: { in: serviceIds },
      },
      select: { channelId: true, serviceId: true, commissionPct: true },
    });

    const ruleMap = new Map<string, number>();
    for (const r of rules) {
      ruleMap.set(`${r.channelId}:${r.serviceId}`, clampCommissionPct(r.commissionPct));
    }

    // 3) Calcular comisiones
    let count = 0;
    let totalCommissionCents = 0;
    const byChannel: Record<string, number> = {};

    // (Opcional debug)
    // const debug: any[] = [];

    for (const r of reservations) {
      const ch = r.channel;
      if (!ch || !ch.commissionEnabled) continue;

      const mainItem = r.items?.[0];
      if (!mainItem) continue;
      if (mainItem.isExtra) continue;

      const base = Number(mainItem.totalPriceCents ?? 0);
      if (base <= 0) continue; // evita "comisiones" sin base

      const key = `${ch.id}:${mainItem.serviceId}`;
      const rulePct = ruleMap.get(key); // 0..100
      const rate = resolveCommissionRate({
        channel: ch,
        serviceId: mainItem.serviceId,
        rulePct: rulePct ?? null,
      });
      if (!rate) continue;

      const commission = commissionFromBase(base, rate);

      // Si por redondeo sale 0, no la contamos
      if (commission <= 0) continue;

      count++;
      totalCommissionCents += commission;
      byChannel[ch.name] = (byChannel[ch.name] ?? 0) + commission;

      // debug.push({ reservationId: r.id, channel: ch.name, base, rate, commission, hasRule: rulePct != null });
    }

    for (const payment of externalPayments) {
      const ch = payment.channel;
      if (!ch || !payment.serviceId || !ch.commissionEnabled) continue;

      const base =
        payment.direction === "OUT" ? -Math.abs(Number(payment.amountCents ?? 0)) : Math.abs(Number(payment.amountCents ?? 0));
      if (base <= 0) continue;

      const key = `${ch.id}:${payment.serviceId}`;
      const rulePct = ruleMap.get(key);
      const rate = resolveCommissionRate({
        channel: ch,
        serviceId: payment.serviceId,
        rulePct: rulePct ?? null,
      });
      if (!rate) continue;

      const commission = commissionFromBase(base, rate);
      if (commission <= 0) continue;

      count++;
      totalCommissionCents += commission;
      byChannel[ch.name] = (byChannel[ch.name] ?? 0) + commission;
    }

    return NextResponse.json({
      count,
      totalCommissionCents,
      byChannel,
      // debug,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 500 });
  }
}

