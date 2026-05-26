export type CommercialSummarySnapshot = {
  pvpOriginalCents: number;
  customerDiscountCents: number;
  autoDiscountCents: number;
  manualDiscountCents: number;
  promoterDiscountCents: number;
  companyDiscountCents: number;
  finalTotalCents: number;
  commissionBaseCents: number;
  appliedCommissionCents: number;
  appliedCommissionMode?: "PERCENT" | "FIXED" | null;
  appliedCommissionValue?: number | null;
  appliedCommissionPct?: number | null;
  pendingToChargeCents: number;
};

function toSafeCents(value: number | null | undefined) {
  return Math.max(0, Number(value ?? 0) || 0);
}

export function normalizeCommercialSummary(
  summary: Partial<CommercialSummarySnapshot> & Pick<CommercialSummarySnapshot, "finalTotalCents">
): CommercialSummarySnapshot {
  return {
    pvpOriginalCents: toSafeCents(summary.pvpOriginalCents),
    customerDiscountCents: toSafeCents(summary.customerDiscountCents),
    autoDiscountCents: toSafeCents(summary.autoDiscountCents),
    manualDiscountCents: toSafeCents(summary.manualDiscountCents),
    promoterDiscountCents: toSafeCents(summary.promoterDiscountCents),
    companyDiscountCents: toSafeCents(summary.companyDiscountCents),
    finalTotalCents: toSafeCents(summary.finalTotalCents),
    commissionBaseCents: toSafeCents(summary.commissionBaseCents),
    appliedCommissionCents: toSafeCents(summary.appliedCommissionCents),
    appliedCommissionMode: summary.appliedCommissionMode ?? null,
    appliedCommissionValue: summary.appliedCommissionValue ?? null,
    appliedCommissionPct: summary.appliedCommissionPct ?? null,
    pendingToChargeCents: toSafeCents(summary.pendingToChargeCents),
  };
}

export function getCommercialSummaryTotalDiscountCents(summary: CommercialSummarySnapshot) {
  return (
    toSafeCents(summary.customerDiscountCents) +
    toSafeCents(summary.autoDiscountCents) +
    toSafeCents(summary.manualDiscountCents)
  );
}

export function hasCommercialSummaryAdjustments(summary: CommercialSummarySnapshot) {
  return (
    getCommercialSummaryTotalDiscountCents(summary) > 0 ||
    toSafeCents(summary.appliedCommissionCents) > 0 ||
    toSafeCents(summary.promoterDiscountCents) > 0 ||
    toSafeCents(summary.companyDiscountCents) > 0
  );
}
