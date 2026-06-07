import test from "node:test";
import assert from "node:assert/strict";

import {
  commercialPricingStateChanged,
  hasSufficientCommercialSnapshot,
  netPaidServiceCents,
  normalizeCommercialPricingState,
  shouldPreserveFormalizeCommercialSnapshot,
} from "./reservation-commercial-snapshot";
import { resolveReservationPaymentStatus } from "./reservation-payment-status";

const completeSnapshot = {
  basePriceCents: 12_000,
  totalPriceCents: 9_000,
  autoDiscountCents: 2_000,
  manualDiscountCents: 1_000,
  customerDiscountCents: 0,
  promoCode: "MAYO",
  commissionBaseCents: 9_000,
  appliedCommissionMode: "PERCENT",
  appliedCommissionPct: 10,
  appliedCommissionValue: 10,
  appliedCommissionCents: 900,
  promoterDiscountCents: 0,
  companyDiscountCents: 3_000,
  items: [{ unitPriceCents: 12_000, totalPriceCents: 12_000 }],
};

test("commercial snapshot is sufficient when reservation and item price snapshots are present", () => {
  assert.equal(hasSufficientCommercialSnapshot(completeSnapshot), true);
});

test("formalize preserves a full paid promo snapshot so pending stays zero", () => {
  const payments = [{ amountCents: 9_000, isDeposit: false, direction: "IN" }];

  assert.equal(
    shouldPreserveFormalizeCommercialSnapshot({ snapshot: completeSnapshot, payments }),
    true
  );

  const status = resolveReservationPaymentStatus({
    totalPriceCents: completeSnapshot.totalPriceCents,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    payments,
  });

  assert.equal(status.pendingServiceCents, 0);
  assert.equal(status.state, "PAID");
});

test("formalize preserves a partial paid promo snapshot and pending uses stored total", () => {
  const payments = [{ amountCents: 4_000, isDeposit: false, direction: "IN" }];
  const status = resolveReservationPaymentStatus({
    totalPriceCents: completeSnapshot.totalPriceCents,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    payments,
  });

  assert.equal(status.pendingServiceCents, 5_000);
  assert.equal(status.state, "PARTIAL");
});

test("legacy reservation without snapshot and without payments can fall back to recalculation", () => {
  assert.equal(
    shouldPreserveFormalizeCommercialSnapshot({
      snapshot: {
        ...completeSnapshot,
        appliedCommissionMode: null,
        items: [{ unitPriceCents: null, totalPriceCents: null }],
      },
      payments: [],
    }),
    false
  );
});

test("payments protect an incomplete legacy commercial row from automatic total increases", () => {
  const payments = [{ amountCents: 5_000, isDeposit: false, direction: "IN" }];

  assert.equal(netPaidServiceCents(payments), 5_000);
  assert.equal(
    shouldPreserveFormalizeCommercialSnapshot({
      snapshot: {
        ...completeSnapshot,
        appliedCommissionMode: null,
        items: [{ unitPriceCents: null, totalPriceCents: null }],
      },
      payments,
    }),
    true
  );
});

test("fixed commission snapshots are valid and stay preserveable", () => {
  assert.equal(
    hasSufficientCommercialSnapshot({
      ...completeSnapshot,
      appliedCommissionMode: "FIXED",
      appliedCommissionPct: null,
      appliedCommissionValue: 15,
      appliedCommissionCents: 1_500,
    }),
    true
  );
});

test("non jetski default tariff fields do not count as a commercial pricing change", () => {
  assert.deepEqual(
    normalizeCommercialPricingState({
      serviceCategory: "TAXIBOAT",
      isLicense: false,
      jetskiLicenseMode: null,
      pricingTier: null,
    }),
    {
      isLicense: false,
      jetskiLicenseMode: "NONE",
      pricingTier: "STANDARD",
    }
  );

  assert.equal(
    commercialPricingStateChanged({
      current: {
        serviceCategory: "TAXIBOAT",
        isLicense: false,
        jetskiLicenseMode: null,
        pricingTier: null,
      },
      requested: {
        serviceCategory: "TAXIBOAT",
        isLicense: false,
        jetskiLicenseMode: "NONE",
        pricingTier: "STANDARD",
      },
    }),
    false
  );
});

test("jetski license mode changes still count as commercial pricing changes", () => {
  assert.equal(
    commercialPricingStateChanged({
      current: {
        serviceCategory: "JETSKI",
        isLicense: false,
        jetskiLicenseMode: "NONE",
        pricingTier: "STANDARD",
      },
      requested: {
        serviceCategory: "JETSKI",
        isLicense: true,
        jetskiLicenseMode: "GREEN_LIMITED",
        pricingTier: "RESIDENT",
      },
    }),
    true
  );
});
