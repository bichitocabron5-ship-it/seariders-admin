import assert from "node:assert/strict";
import test from "node:test";

import { buildStoreCreateCommercialSummary } from "./store-create-commercial";

test("pantalla contratos mantiene el snapshot comercial guardado y no vuelve a PVP", () => {
  const summary = buildStoreCreateCommercialSummary({
    hasPersistedCommercialSnapshot: true,
    prefillPricing: {
      basePriceCents: 10_000,
      customerDiscountCents: 1_000,
      manualDiscountCents: 500,
      totalPriceCents: 8_500,
      commissionBaseCents: 8_500,
      appliedCommissionCents: 850,
      appliedCommissionMode: "PERCENT",
      appliedCommissionValue: 10,
      appliedCommissionPct: 10,
    },
    paymentPendingServiceCents: 0,
    shownBaseCents: 10_000,
    shownDiscountCents: 0,
    manualDiscountCents: 0,
    shownFinalCentsWithManual: 10_000,
    storeCommissionCents: 0,
    commercialPreview: {},
    commissionBreakdown: {
      commissionBaseCents: 10_000,
      promoterDiscountCents: 0,
      companyDiscountCents: 0,
    },
  });

  assert.equal(summary.pvpOriginalCents, 10_000);
  assert.equal(summary.finalTotalCents, 8_500);
  assert.equal(summary.pendingToChargeCents, 8_500);
  assert.equal(summary.appliedCommissionCents, 850);
});

test("snapshot persistido de booth conserva descuento manual y total final guardados", () => {
  const summary = buildStoreCreateCommercialSummary({
    hasPersistedCommercialSnapshot: true,
    prefillPricing: {
      basePriceCents: 10_000,
      manualDiscountCents: 1_000,
      totalPriceCents: 9_000,
      commissionBaseCents: 9_000,
      appliedCommissionCents: 900,
    },
    paymentPendingServiceCents: 2_500,
    shownBaseCents: 10_000,
    shownDiscountCents: 0,
    manualDiscountCents: 0,
    shownFinalCentsWithManual: 10_000,
    storeCommissionCents: 0,
    commercialPreview: {},
    commissionBreakdown: {
      commissionBaseCents: 10_000,
      promoterDiscountCents: 0,
      companyDiscountCents: 0,
    },
  });

  assert.equal(summary.manualDiscountCents, 1_000);
  assert.equal(summary.finalTotalCents, 9_000);
  assert.equal(summary.pendingToChargeCents, 2_500);
});
