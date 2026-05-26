import {
  normalizeCommercialSummary,
  type CommercialSummarySnapshot,
} from "@/app/store/shared/commercial-summary";

type PrefillPricingSnapshot = {
  basePriceCents?: number | null;
  commissionBaseCents?: number | null;
  appliedCommissionMode?: "PERCENT" | "FIXED" | null;
  appliedCommissionValue?: number | null;
  appliedCommissionPct?: number | null;
  appliedCommissionCents?: number | null;
  manualDiscountCents?: number | null;
  autoDiscountCents?: number | null;
  customerDiscountCents?: number | null;
  promoterDiscountCents?: number | null;
  companyDiscountCents?: number | null;
  totalPriceCents?: number | null;
};

type LiveCommercialPreview = {
  customerDiscountCents?: number | null;
  appliedCommissionMode?: "PERCENT" | "FIXED" | null;
  appliedCommissionValue?: number | null;
};

export function buildStoreCreateCommercialSummary(args: {
  hasPersistedCommercialSnapshot: boolean;
  prefillPricing: PrefillPricingSnapshot | null;
  paymentPendingServiceCents: number;
  shownBaseCents: number;
  shownDiscountCents: number;
  manualDiscountCents: number;
  shownFinalCentsWithManual: number;
  storeCommissionCents: number;
  commercialPreview: LiveCommercialPreview;
  commissionBreakdown: {
    commissionBaseCents: number;
    promoterDiscountCents: number;
    companyDiscountCents: number;
  };
}): CommercialSummarySnapshot {
  const {
    hasPersistedCommercialSnapshot,
    prefillPricing,
    paymentPendingServiceCents,
    shownBaseCents,
    shownDiscountCents,
    manualDiscountCents,
    shownFinalCentsWithManual,
    storeCommissionCents,
    commercialPreview,
    commissionBreakdown,
  } = args;

  return normalizeCommercialSummary(
    hasPersistedCommercialSnapshot
      ? {
          pvpOriginalCents: prefillPricing?.basePriceCents ?? 0,
          customerDiscountCents: prefillPricing?.customerDiscountCents ?? 0,
          autoDiscountCents: prefillPricing?.autoDiscountCents ?? 0,
          manualDiscountCents: prefillPricing?.manualDiscountCents ?? 0,
          promoterDiscountCents: prefillPricing?.promoterDiscountCents ?? 0,
          companyDiscountCents: prefillPricing?.companyDiscountCents ?? 0,
          finalTotalCents: prefillPricing?.totalPriceCents ?? 0,
          commissionBaseCents: prefillPricing?.commissionBaseCents ?? 0,
          appliedCommissionCents: prefillPricing?.appliedCommissionCents ?? 0,
          appliedCommissionMode: prefillPricing?.appliedCommissionMode ?? null,
          appliedCommissionValue: prefillPricing?.appliedCommissionValue ?? 0,
          appliedCommissionPct: prefillPricing?.appliedCommissionPct ?? null,
          pendingToChargeCents: paymentPendingServiceCents || Number(prefillPricing?.totalPriceCents ?? 0),
        }
      : {
          pvpOriginalCents: shownBaseCents,
          customerDiscountCents: Number(commercialPreview.customerDiscountCents ?? 0),
          autoDiscountCents: shownDiscountCents,
          manualDiscountCents,
          promoterDiscountCents: commissionBreakdown.promoterDiscountCents,
          companyDiscountCents: commissionBreakdown.companyDiscountCents,
          finalTotalCents: shownFinalCentsWithManual,
          commissionBaseCents: commissionBreakdown.commissionBaseCents,
          appliedCommissionCents: storeCommissionCents,
          appliedCommissionMode: commercialPreview.appliedCommissionMode,
          appliedCommissionValue: Number(commercialPreview.appliedCommissionValue ?? 0),
          appliedCommissionPct: null,
          pendingToChargeCents: paymentPendingServiceCents || shownFinalCentsWithManual,
        }
  );
}
