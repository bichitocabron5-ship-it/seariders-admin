import { PaymentOrigin } from "@prisma/client";

import { commissionFromBase, proportionalCommissionBaseForCollected, resolveCommissionRate } from "@/lib/commission";
import { prisma } from "@/lib/prisma";

function signed(amountCents: number, direction: string) {
  return direction === "OUT" ? -Math.abs(amountCents) : Math.abs(amountCents);
}

export async function getCashClosureCommissionSummary(args: {
  closureId: string;
  origin: PaymentOrigin;
  windowFrom: Date;
  windowTo: Date;
}) {
  const payments = await prisma.payment.findMany({
    where: {
      origin: args.origin,
      createdAt: { gte: args.windowFrom, lt: args.windowTo },
      OR: [{ reservationId: { not: null } }, { reservationId: null, channelId: { not: null }, serviceId: { not: null } }],
    },
    select: {
      reservationId: true,
      serviceId: true,
      channelId: true,
      amountCents: true,
      commissionBaseCents: true,
      isExternalCommissionOnly: true,
      externalGrossAmountCents: true,
      direction: true,
      isDeposit: true,
      channel: {
        select: {
          id: true,
          name: true,
          kind: true,
          commissionEnabled: true,
          commissionAppliesToDeposit: true,
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

  const reservationIds = Array.from(new Set(payments.map((p) => p.reservationId!).filter(Boolean)));

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: reservationIds } },
    select: {
      id: true,
      serviceId: true,
      totalPriceCents: true,
      commissionBaseCents: true,
      channelId: true,
      channel: {
        select: {
          id: true,
          name: true,
          kind: true,
          commissionEnabled: true,
          commissionAppliesToDeposit: true,
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

  const netServiceByRes = new Map<string, number>();
  const netDepositByRes = new Map<string, number>();

  for (const p of payments) {
    const rid = p.reservationId!;
    const amt = signed(p.amountCents, p.direction);
    if (p.isDeposit) netDepositByRes.set(rid, (netDepositByRes.get(rid) ?? 0) + amt);
    else netServiceByRes.set(rid, (netServiceByRes.get(rid) ?? 0) + amt);
  }

  const byChannel = new Map<
    string,
    {
      channelId: string;
      name: string;
      kind: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
      baseServiceCents: number;
      baseDepositCents: number;
      baseTotalCents: number;
      commissionCents: number;
      effectivePct: number;
      companyCommissionCents: number;
      channelCommissionCostCents: number;
      reservations: number;
    }
  >();

  let totalCommissionCents = 0;
  let totalCompanyCommissionCents = 0;
  let totalChannelCommissionCostCents = 0;

  function ensureRow(channelId: string, name: string, kind: "STANDARD" | "EXTERNAL_ACTIVITY" | null) {
    if (!byChannel.has(channelId)) {
      byChannel.set(channelId, {
        channelId,
        name,
        kind,
        baseServiceCents: 0,
        baseDepositCents: 0,
        baseTotalCents: 0,
        commissionCents: 0,
        effectivePct: 0,
        companyCommissionCents: 0,
        channelCommissionCostCents: 0,
        reservations: 0,
      });
    }
    return byChannel.get(channelId)!;
  }

  function accumulateCommission(row: ReturnType<typeof ensureRow>, commissionCents: number) {
    totalCommissionCents += commissionCents;
    row.commissionCents += commissionCents;
    if (row.kind === "EXTERNAL_ACTIVITY") {
      totalCompanyCommissionCents += commissionCents;
      row.companyCommissionCents += commissionCents;
    } else {
      totalChannelCommissionCostCents += commissionCents;
      row.channelCommissionCostCents += commissionCents;
    }
  }

  for (const r of reservations) {
    const ch = r.channel;
    if (!ch || !ch.commissionEnabled) continue;

    const rate = resolveCommissionRate({
      channel: ch,
      serviceId: r.serviceId,
    });
    if (!rate) continue;

    const rawNetService = netServiceByRes.get(r.id) ?? 0;
    const baseService =
      Number(r.commissionBaseCents ?? 0) > 0 && Number(r.totalPriceCents ?? 0) > 0
        ? proportionalCommissionBaseForCollected({
            collectedNetCents: rawNetService,
            reservationNetCents: Number(r.totalPriceCents ?? 0),
            reservationCommissionBaseCents: Number(r.commissionBaseCents ?? 0),
          })
        : rawNetService;
    const baseDeposit = netDepositByRes.get(r.id) ?? 0;
    const baseTotal = baseService + (ch.commissionAppliesToDeposit ? baseDeposit : 0);

    if (!baseTotal) continue;

    const c = commissionFromBase(baseTotal, rate);
    const row = ensureRow(ch.id, ch.name, ch.kind ?? null);
    accumulateCommission(row, c);
    row.baseServiceCents += baseService;
    row.baseDepositCents += baseDeposit;
    row.baseTotalCents += baseTotal;
    row.reservations += 1;
  }

  for (const p of payments) {
    if (p.reservationId || !p.channelId || !p.serviceId) continue;

    const ch = p.channel;
    if (!ch || !ch.commissionEnabled) continue;
    const row = ensureRow(ch.id, ch.name, ch.kind ?? null);

    if (p.isExternalCommissionOnly) {
      const commissionOnlyAmount = signed(p.amountCents, p.direction);
      if (!commissionOnlyAmount) continue;
      accumulateCommission(row, commissionOnlyAmount);
      const grossBase = signed(p.commissionBaseCents ?? p.externalGrossAmountCents ?? p.amountCents, p.direction);
      if (p.isDeposit) row.baseDepositCents += grossBase;
      else row.baseServiceCents += grossBase;
      row.baseTotalCents += grossBase;
      row.reservations += 1;
      continue;
    }

    const baseTotal = p.isDeposit && !ch.commissionAppliesToDeposit ? 0 : signed(p.commissionBaseCents ?? p.amountCents, p.direction);
    if (!baseTotal) continue;

    const c = commissionFromBase(
      baseTotal,
      resolveCommissionRate({
        channel: ch,
        serviceId: p.serviceId,
      })
    );
    if (!c) continue;

    accumulateCommission(row, c);
    if (p.isDeposit) row.baseDepositCents += baseTotal;
    else row.baseServiceCents += baseTotal;
    row.baseTotalCents += baseTotal;
    row.reservations += 1;
  }

  const rows = Array.from(byChannel.values())
    .map((row) => ({
      ...row,
      effectivePct: row.baseTotalCents > 0 ? Number(((row.commissionCents / row.baseTotalCents) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.commissionCents - a.commissionCents);

  return {
    ok: true as const,
    totalCommissionCents,
    totalCompanyCommissionCents,
    totalChannelCommissionCostCents,
    rows,
  };
}
