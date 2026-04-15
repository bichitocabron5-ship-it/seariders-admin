import { prisma } from "@/lib/prisma";

export type CommissionRuleLike = {
  serviceId: string;
  commissionPct?: number | null;
};

export type CommissionChannelLike = {
  kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
  commissionEnabled?: boolean | null;
  commissionBps?: number | null;
  commissionPct?: number | null;
  commissionRules?: CommissionRuleLike[] | null;
};

export function clampCommissionPct(p: unknown) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
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

/**
 * Regla:
 * 1) Si item es extra -> 0 (extras NO comisionan)
 * 2) Busca regla específica (channel+service)
 * 3) Si no hay, usa channel.commissionPct
 * 4) Si no hay, 0
 */
export async function resolveCommissionPct(params: {
  channelId: string | null;
  serviceId: string;
  isExtra: boolean;
}) {
  const { channelId, serviceId, isExtra } = params;

  if (isExtra) return 0;
  if (!channelId) return 0;

  const rule = await prisma.channelCommissionRule.findFirst({
    where: { channelId, serviceId, isActive: true },
    select: { commissionPct: true },
  });

  if (rule) return rule.commissionPct;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { commissionPct: true },
  });

  return channel?.commissionPct ?? 0;
}
