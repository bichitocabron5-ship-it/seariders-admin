import type { Prisma } from "@prisma/client";

export type DiscountResponsibility = "COMPANY" | "PROMOTER" | "SHARED";
export type CommercialValueMode = "PERCENT" | "FIXED";

export type CommissionRuleLike = {
  serviceId: string;
  commissionPct?: number | null;
  promoterCommissionMode?: CommercialValueMode | null;
  promoterCommissionValue?: number | null;
  promoterCommissionCents?: number | null;
};

export type CommissionChannelLike = {
  kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
  commissionEnabled?: boolean | null;
  commissionBps?: number | null;
  commissionPct?: number | null;
  promoterCommissionMode?: CommercialValueMode | null;
  promoterCommissionValue?: number | null;
  promoterCommissionCents?: number | null;
  customerDiscountMode?: CommercialValueMode | null;
  customerDiscountValue?: number | null;
  customerDiscountCents?: number | null;
  discountResponsibility?: DiscountResponsibility | null;
  promoterDiscountShareBps?: number | null;
  commissionRules?: CommissionRuleLike[] | null;
};

export type AppliedCommercialSnapshot = {
  appliedCommissionPct: number | null;
  appliedCommissionMode: CommercialValueMode;
  appliedCommissionValue: number;
  appliedCommissionCents: number;
  customerDiscountMode: CommercialValueMode;
  customerDiscountValue: number;
  customerDiscountCents: number;
};

export function clampCommissionPct(p: unknown) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function clampBps(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(n)));
}

export function roundCents(n: number) {
  return Math.round(Number(n ?? 0));
}

export function pctToRate(pct?: number | null) {
  return clampCommissionPct(pct) / 100;
}

export function bpsToRate(bps?: number | null) {
  const n = Number(bps ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 10_000;
}

export function commissionFromBase(baseCents: number, rate: number) {
  return roundCents(Number(baseCents ?? 0) * Number(rate ?? 0));
}

export function rateToPct(rate: number) {
  return Number((Math.max(0, Math.min(1, Number(rate ?? 0))) * 100).toFixed(2));
}

export function commissionRateForSeariders(rate: number, kind?: CommissionChannelLike["kind"]) {
  const normalized = Math.max(0, Math.min(1, Number(rate ?? 0)));
  if (kind === "EXTERNAL_ACTIVITY") {
    return Math.max(0, Math.min(1, 1 - normalized));
  }
  return normalized;
}

export function normalizeCommercialValueMode(value?: string | null): CommercialValueMode {
  return value === "FIXED" ? "FIXED" : "PERCENT";
}

function coerceCommercialValue(mode: CommercialValueMode, value?: number | null, cents?: number | null) {
  if (mode === "FIXED") {
    const fixedCents = Math.max(0, roundCents(cents ?? value ?? 0));
    return { mode, value: fixedCents / 100, cents: fixedCents };
  }

  const pct = Math.max(0, Number(value ?? 0));
  return { mode, value: pct, cents: 0 };
}

function resolveRuleCommercial(args: {
  channel?: CommissionChannelLike | null;
  serviceId: string;
  rulePct?: number | null;
}) {
  const { channel, serviceId, rulePct } = args;
  const rule = channel?.commissionRules?.find((item) => item.serviceId === serviceId) ?? null;

  if (rulePct != null) {
    return {
      mode: "PERCENT" as const,
      value: clampCommissionPct(rulePct),
      cents: 0,
      source: "RULE_PCT" as const,
    };
  }

  if (rule) {
    const mode = normalizeCommercialValueMode(rule.promoterCommissionMode);
    if (mode === "FIXED") {
      const fixed = coerceCommercialValue(
        mode,
        rule.promoterCommissionValue,
        rule.promoterCommissionCents
      );
      if (fixed.cents > 0) {
        return { ...fixed, source: "RULE_FIXED" as const };
      }
    }

    if (rule.commissionPct != null) {
      return {
        mode: "PERCENT" as const,
        value: clampCommissionPct(rule.commissionPct),
        cents: 0,
        source: "RULE_PCT" as const,
      };
    }
  }

  const channelMode = normalizeCommercialValueMode(channel?.promoterCommissionMode);
  if (channelMode === "FIXED") {
    const fixed = coerceCommercialValue(
      channelMode,
      channel?.promoterCommissionValue,
      channel?.promoterCommissionCents
    );
    if (fixed.cents > 0) {
      return { ...fixed, source: "CHANNEL_FIXED" as const };
    }
  }

  const byBps = (Number(channel?.commissionBps ?? 0) || 0) / 100;
  if (byBps > 0) {
    return {
      mode: "PERCENT" as const,
      value: byBps,
      cents: 0,
      source: "CHANNEL_BPS" as const,
    };
  }

  return {
    mode: "PERCENT" as const,
    value: Math.max(0, Number(channel?.commissionPct ?? 0) || 0),
    cents: 0,
    source: "CHANNEL_PCT" as const,
  };
}

export function resolveCommissionRate(args: {
  channel?: CommissionChannelLike | null;
  serviceId: string;
  rulePct?: number | null;
}) {
  const { channel } = args;
  if (!channel || !channel.commissionEnabled) return 0;

  const resolved = resolveRuleCommercial(args);
  if (resolved.mode === "FIXED") return 0;

  return commissionRateForSeariders(pctToRate(resolved.value), channel.kind);
}

export function resolveAppliedCommissionPct(args: {
  channel?: CommissionChannelLike | null;
  serviceId: string;
  rulePct?: number | null;
}) {
  const { channel } = args;
  if (!channel || !channel.commissionEnabled) return null;

  const resolved = resolveRuleCommercial(args);
  if (resolved.mode === "FIXED") return null;

  return rateToPct(resolveCommissionRate(args));
}

export function resolveCustomerDiscountSnapshot(args: {
  channel?: CommissionChannelLike | null;
  quantity?: number | null;
  baseCents: number;
}) {
  const mode = normalizeCommercialValueMode(args.channel?.customerDiscountMode);
  const value = Number(args.channel?.customerDiscountValue ?? 0) || 0;
  const quantity = Math.max(1, Number(args.quantity ?? 1));
  const baseCents = Math.max(0, roundCents(args.baseCents));

  if (!args.channel) {
    return {
      customerDiscountMode: "PERCENT" as const,
      customerDiscountValue: 0,
      customerDiscountCents: 0,
    };
  }

  if (mode === "FIXED") {
    const fixedPerUnitCents = Math.max(
      0,
      roundCents(args.channel?.customerDiscountCents ?? Math.round(value * 100))
    );
    return {
      customerDiscountMode: mode,
      customerDiscountValue: fixedPerUnitCents / 100,
      customerDiscountCents: Math.min(baseCents, fixedPerUnitCents * quantity),
    };
  }

  const pct = Math.max(0, value);
  return {
    customerDiscountMode: mode,
    customerDiscountValue: pct,
    customerDiscountCents: Math.min(baseCents, commissionFromBase(baseCents, pct / 100)),
  };
}

export function resolveAppliedCommercialSnapshot(args: {
  channel?: CommissionChannelLike | null;
  serviceId: string;
  commissionBaseCents: number;
  finalTotalCents?: number | null;
  quantity?: number | null;
  customerDiscountBaseCents: number;
  rulePct?: number | null;
}) {
  const { channel } = args;
  const quantity = Math.max(1, Number(args.quantity ?? 1));
  const customerDiscount = resolveCustomerDiscountSnapshot({
    channel,
    quantity,
    baseCents: args.customerDiscountBaseCents,
  });

  if (!channel || !channel.commissionEnabled) {
    return {
      appliedCommissionPct: null,
      appliedCommissionMode: "PERCENT" as const,
      appliedCommissionValue: 0,
      appliedCommissionCents: 0,
      ...customerDiscount,
    };
  }

  const resolved = resolveRuleCommercial(args);
  if (resolved.mode === "FIXED") {
    return {
      appliedCommissionPct: null,
      appliedCommissionMode: resolved.mode,
      appliedCommissionValue: resolved.cents / 100,
      appliedCommissionCents: resolved.cents * quantity,
      ...customerDiscount,
    };
  }

  const configuredRate = pctToRate(resolved.value);
  const appliedCommissionPct = rateToPct(
    commissionRateForSeariders(configuredRate, channel.kind)
  );
  const finalTotalCents = Math.max(0, roundCents(args.finalTotalCents ?? args.commissionBaseCents));
  const appliedCommissionCents =
    channel.kind === "EXTERNAL_ACTIVITY"
      ? Math.max(0, finalTotalCents - commissionFromBase(args.commissionBaseCents, configuredRate))
      : commissionFromBase(args.commissionBaseCents, appliedCommissionPct / 100);

  return {
    appliedCommissionPct,
    appliedCommissionMode: resolved.mode,
    appliedCommissionValue: resolved.value,
    appliedCommissionCents,
    ...customerDiscount,
  };
}

export async function getAppliedCommercialSnapshotTx(
  tx: Prisma.TransactionClient,
  args: {
    channelId?: string | null;
    serviceId?: string | null;
    commissionBaseCents: number;
    finalTotalCents?: number | null;
    customerDiscountBaseCents: number;
    quantity?: number | null;
  }
) {
  if (!args.channelId || !args.serviceId) {
    return resolveAppliedCommercialSnapshot({
      channel: null,
      serviceId: args.serviceId ?? "",
      commissionBaseCents: args.commissionBaseCents,
      finalTotalCents: args.finalTotalCents,
      customerDiscountBaseCents: args.customerDiscountBaseCents,
      quantity: args.quantity,
    });
  }

  const channel = await tx.channel.findUnique({
    where: { id: args.channelId },
    select: {
      kind: true,
      commissionEnabled: true,
      commissionBps: true,
      commissionPct: true,
      promoterCommissionMode: true,
      promoterCommissionValue: true,
      promoterCommissionCents: true,
      customerDiscountMode: true,
      customerDiscountValue: true,
      customerDiscountCents: true,
      commissionRules: {
        where: {
          isActive: true,
          serviceId: args.serviceId,
        },
        select: {
          serviceId: true,
          commissionPct: true,
          promoterCommissionMode: true,
          promoterCommissionValue: true,
          promoterCommissionCents: true,
        },
      },
    },
  });

  return resolveAppliedCommercialSnapshot({
    channel,
    serviceId: args.serviceId,
    commissionBaseCents: args.commissionBaseCents,
    finalTotalCents: args.finalTotalCents,
    customerDiscountBaseCents: args.customerDiscountBaseCents,
    quantity: args.quantity,
  });
}

export async function getAppliedCommissionPctTx(
  tx: Prisma.TransactionClient,
  args: { channelId?: string | null; serviceId?: string | null }
) {
  if (!args.channelId || !args.serviceId) return null;

  const snapshot = await getAppliedCommercialSnapshotTx(tx, {
    channelId: args.channelId,
    serviceId: args.serviceId,
    commissionBaseCents: 0,
    finalTotalCents: 0,
    customerDiscountBaseCents: 0,
    quantity: 1,
  });

  return snapshot.appliedCommissionPct;
}

export function normalizeDiscountResponsibility(value?: string | null): DiscountResponsibility {
  if (value === "PROMOTER" || value === "SHARED") return value;
  return "COMPANY";
}

export function defaultPromoterDiscountShareBps(
  responsibility: DiscountResponsibility,
  shareBps?: number | null
) {
  if (responsibility === "PROMOTER") return 10_000;
  if (responsibility === "COMPANY") return 0;
  return clampBps(shareBps);
}

export function resolveDiscountPolicy(args: {
  responsibility?: string | null;
  promoterDiscountShareBps?: number | null;
  channel?: Pick<CommissionChannelLike, "discountResponsibility" | "promoterDiscountShareBps"> | null;
}) {
  const responsibility = normalizeDiscountResponsibility(
    args.responsibility ?? args.channel?.discountResponsibility ?? "COMPANY"
  );
  const promoterDiscountShareBps = defaultPromoterDiscountShareBps(
    responsibility,
    args.promoterDiscountShareBps ?? args.channel?.promoterDiscountShareBps ?? null
  );

  return {
    discountResponsibility: responsibility,
    promoterDiscountShareBps,
  };
}

export function splitDiscountByResponsibility(args: {
  discountCents: number;
  responsibility?: string | null;
  promoterDiscountShareBps?: number | null;
}) {
  const discountCents = Math.max(0, roundCents(args.discountCents));
  const discountResponsibility = normalizeDiscountResponsibility(args.responsibility);
  const promoterDiscountShareBps = defaultPromoterDiscountShareBps(
    discountResponsibility,
    args.promoterDiscountShareBps
  );

  const promoterDiscountCents =
    discountResponsibility === "COMPANY"
      ? 0
      : discountResponsibility === "PROMOTER"
        ? discountCents
        : roundCents(discountCents * (promoterDiscountShareBps / 10_000));
  const companyDiscountCents = Math.max(0, discountCents - promoterDiscountCents);

  return {
    discountCents,
    discountResponsibility,
    promoterDiscountShareBps,
    promoterDiscountCents,
    companyDiscountCents,
  };
}

export function allocateDiscountProportionally(args: {
  totalDiscountCents: number;
  scopedGrossCents: number;
  totalGrossCents: number;
}) {
  const totalDiscountCents = Math.max(0, roundCents(args.totalDiscountCents));
  const scopedGrossCents = Math.max(0, roundCents(args.scopedGrossCents));
  const totalGrossCents = Math.max(0, roundCents(args.totalGrossCents));

  if (totalDiscountCents <= 0 || scopedGrossCents <= 0 || totalGrossCents <= 0) return 0;
  if (scopedGrossCents >= totalGrossCents) return totalDiscountCents;

  return Math.min(
    totalDiscountCents,
    roundCents(totalDiscountCents * (scopedGrossCents / totalGrossCents))
  );
}

export function computeCommissionableBase(args: {
  grossBaseCents: number;
  totalDiscountCents?: number;
  responsibility?: string | null;
  promoterDiscountShareBps?: number | null;
}) {
  const grossBaseCents = Math.max(0, roundCents(args.grossBaseCents));
  const totalDiscountCents = Math.max(0, roundCents(args.totalDiscountCents ?? 0));
  const split = splitDiscountByResponsibility({
    discountCents: totalDiscountCents,
    responsibility: args.responsibility ?? "COMPANY",
    promoterDiscountShareBps: args.promoterDiscountShareBps ?? null,
  });
  const commissionBaseCents = Math.max(0, grossBaseCents - totalDiscountCents);

  return {
    grossBaseCents,
    commissionBaseCents,
    ...split,
  };
}

export function computeCommissionableBaseFromScopedDiscount(args: {
  grossBaseCents: number;
  totalDiscountCents: number;
  totalGrossCents: number;
  responsibility?: string | null;
  promoterDiscountShareBps?: number | null;
}) {
  const scopedDiscountCents = allocateDiscountProportionally({
    totalDiscountCents: args.totalDiscountCents,
    scopedGrossCents: args.grossBaseCents,
    totalGrossCents: args.totalGrossCents,
  });

  return computeCommissionableBase({
    grossBaseCents: args.grossBaseCents,
    totalDiscountCents: scopedDiscountCents,
    responsibility: args.responsibility,
    promoterDiscountShareBps: args.promoterDiscountShareBps,
  });
}

export function proportionalCommissionBaseForCollected(args: {
  collectedNetCents: number;
  reservationNetCents: number;
  reservationCommissionBaseCents: number;
}) {
  const collectedNetCents = Math.max(0, roundCents(args.collectedNetCents));
  const reservationNetCents = Math.max(0, roundCents(args.reservationNetCents));
  const reservationCommissionBaseCents = Math.max(0, roundCents(args.reservationCommissionBaseCents));

  if (collectedNetCents <= 0 || reservationNetCents <= 0 || reservationCommissionBaseCents <= 0) return 0;

  return roundCents(collectedNetCents * (reservationCommissionBaseCents / reservationNetCents));
}
