import {
  commissionFromBase,
  normalizeCommercialValueMode,
  resolveAppliedCommercialSnapshot,
  roundCents,
  type CommissionChannelLike,
  type CommercialValueMode,
} from "@/lib/commission";

export type ReportingCommissionSource = "SNAPSHOT" | "LEGACY_RECALCULATED" | "NONE";

type SnapshotFields = {
  commissionBaseCents?: number | null;
  appliedCommissionMode?: string | null;
  appliedCommissionValue?: number | null;
  appliedCommissionPct?: number | null;
  appliedCommissionCents?: number | null;
};

type LegacyFallbackFields = {
  channel?: CommissionChannelLike | null;
  serviceId?: string | null;
  quantity?: number | null;
  legacyBaseCents?: number | null;
};

export type ReportingCommissionEntity = SnapshotFields & LegacyFallbackFields;

export type ResolvedReportingCommission = {
  commissionBaseCents: number;
  appliedCommissionMode: CommercialValueMode;
  appliedCommissionValue: number;
  appliedCommissionPct: number | null;
  appliedCommissionCents: number;
  source: ReportingCommissionSource;
};

function hasSnapshot(args: {
  commissionBaseCents: number;
  appliedCommissionMode: CommercialValueMode;
  appliedCommissionValue: number;
  appliedCommissionPct: number | null;
  appliedCommissionCents: number;
}) {
  if (args.appliedCommissionMode === "FIXED") {
    return args.appliedCommissionValue > 0 || args.appliedCommissionCents > 0;
  }

  if (args.appliedCommissionPct != null) return true;
  return args.commissionBaseCents > 0 && args.appliedCommissionCents > 0;
}

export function resolveCommissionForReporting(
  entity: ReportingCommissionEntity
): ResolvedReportingCommission {
  const commissionBaseCents = Math.max(0, roundCents(entity.commissionBaseCents ?? 0));
  const appliedCommissionMode = normalizeCommercialValueMode(entity.appliedCommissionMode);
  const appliedCommissionValue = Math.max(0, Number(entity.appliedCommissionValue ?? 0) || 0);
  const appliedCommissionPct =
    entity.appliedCommissionPct != null ? Number(entity.appliedCommissionPct) : null;
  const appliedCommissionCents = Math.max(0, roundCents(entity.appliedCommissionCents ?? 0));

  if (
    hasSnapshot({
      commissionBaseCents,
      appliedCommissionMode,
      appliedCommissionValue,
      appliedCommissionPct,
      appliedCommissionCents,
    })
  ) {
    return {
      commissionBaseCents,
      appliedCommissionMode,
      appliedCommissionValue,
      appliedCommissionPct,
      appliedCommissionCents,
      source: "SNAPSHOT",
    };
  }

  const legacyBaseCents = Math.max(0, roundCents(entity.legacyBaseCents ?? 0));
  if (!entity.channel || !entity.serviceId || legacyBaseCents <= 0) {
    return {
      commissionBaseCents,
      appliedCommissionMode,
      appliedCommissionValue,
      appliedCommissionPct,
      appliedCommissionCents,
      source: "NONE",
    };
  }

  const recalculated = resolveAppliedCommercialSnapshot({
    channel: entity.channel,
    serviceId: entity.serviceId,
    commissionBaseCents: legacyBaseCents,
    customerDiscountBaseCents: legacyBaseCents,
    quantity: entity.quantity,
  });

  return {
    commissionBaseCents: legacyBaseCents,
    appliedCommissionMode: recalculated.appliedCommissionMode,
    appliedCommissionValue: recalculated.appliedCommissionValue,
    appliedCommissionPct: recalculated.appliedCommissionPct,
    appliedCommissionCents:
      recalculated.appliedCommissionMode === "FIXED"
        ? Math.max(0, roundCents(recalculated.appliedCommissionCents))
        : commissionFromBase(
            legacyBaseCents,
            Math.max(0, Number(recalculated.appliedCommissionPct ?? 0)) / 100
          ),
    source: "LEGACY_RECALCULATED",
  };
}
