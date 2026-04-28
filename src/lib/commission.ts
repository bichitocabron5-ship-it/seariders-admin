import type { Prisma } from "@prisma/client";

export type DiscountResponsibility = "COMPANY" | "PROMOTER" | "SHARED";

export type CommissionRuleLike = {
  serviceId: string;
  commissionPct?: number | null;
};

export type CommissionChannelLike = {
  kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
  commissionEnabled?: boolean | null;
  commissionBps?: number | null;
  commissionPct?: number | null;
  discountResponsibility?: DiscountResponsibility | null;
  promoterDiscountShareBps?: number | null;
  commissionRules?: CommissionRuleLike[] | null;
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

export function pctToRate(pct?: number | null) {
  return clampCommissionPct(pct) / 100;
}

export function bpsToRate(bps?: number | null) {
  const n = Number(bps ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 10000;
}

export function roundCents(n: number) {
  return Math.round(Number(n ?? 0));
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

export function resolveCommissionRate(args: {
  channel?: CommissionChannelLike | null;
  serviceId: string;
  rulePct?: number | null;
}) {
  const { channel, serviceId, rulePct } = args;
  if (!channel || !channel.commissionEnabled) return 0;

  if (rulePct != null) return commissionRateForSeariders(pctToRate(rulePct), channel.kind);

  const rule = channel.commissionRules?.find((r) => r.serviceId === serviceId);
  if (rule && rule.commissionPct != null) {
    return commissionRateForSeariders(pctToRate(rule.commissionPct), channel.kind);
  }

  const byBps = bpsToRate(channel.commissionBps);
  if (byBps > 0) return commissionRateForSeariders(byBps, channel.kind);

  return commissionRateForSeariders(pctToRate(channel.commissionPct), channel.kind);
}

export function resolveAppliedCommissionPct(args: {
  channel?: CommissionChannelLike | null;
  serviceId: string;
  rulePct?: number | null;
}) {
  const { channel } = args;
  if (!channel || !channel.commissionEnabled) return null;
  return rateToPct(resolveCommissionRate(args));
}

export async function getAppliedCommissionPctTx(
  tx: Prisma.TransactionClient,
  args: { channelId?: string | null; serviceId?: string | null }
) {
  if (!args.channelId || !args.serviceId) return null;

  const channel = await tx.channel.findUnique({
    where: { id: args.channelId },
    select: {
      kind: true,
      commissionEnabled: true,
      commissionBps: true,
      commissionPct: true,
      commissionRules: {
        where: {
          isActive: true,
          serviceId: args.serviceId,
        },
        select: { serviceId: true, commissionPct: true },
      },
    },
  });

  return resolveAppliedCommissionPct({
    channel,
    serviceId: args.serviceId,
  });
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
  const split = splitDiscountByResponsibility({
    discountCents: args.totalDiscountCents ?? 0,
    responsibility: args.responsibility ?? "COMPANY",
    promoterDiscountShareBps: args.promoterDiscountShareBps ?? null,
  });
  const commissionBaseCents = Math.max(0, grossBaseCents - split.promoterDiscountCents);

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
