import test from "node:test";
import assert from "node:assert/strict";

import {
  buildComparableCommercialComposition,
  commercialPricingStateChanged,
  getCommercialCommitmentBlockers,
  hasExplicitPromoCodeChange,
  hasSufficientCommercialSnapshot,
  hasCommercialRecalculationCommitment,
  isReservationCoveredByPrepaidVoucher,
  netPaidServiceCents,
  normalizeCommercialPricingState,
  resolveChargeableServiceDueCents,
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

test("commercial composition ignores pax and preserves equivalent service option quantity", () => {
  assert.deepEqual(
    buildComparableCommercialComposition([
      { serviceId: "svc-b", optionId: "opt-2", quantity: 1 },
      { serviceId: "svc-a", optionId: "opt-1", quantity: 2 },
    ]),
    [
      { serviceId: "svc-a", optionId: "opt-1", quantity: 2 },
      { serviceId: "svc-b", optionId: "opt-2", quantity: 1 },
    ]
  );
});

test("missing promoCode in incoming items does not clear a valid snapshot", () => {
  assert.equal(
    hasExplicitPromoCodeChange({
      currentPromoCode: "MAYO",
      requestedPromoCodes: [null, undefined],
    }),
    false
  );
});

test("different incoming promoCode is a commercial change", () => {
  assert.equal(
    hasExplicitPromoCodeChange({
      currentPromoCode: "MAYO",
      requestedPromoCodes: ["JUNIO"],
    }),
    true
  );
});

function commercialCommitmentArgs(overrides: Partial<Parameters<typeof getCommercialCommitmentBlockers>[0]> = {}) {
  return {
    status: "WAITING",
    formalizedAt: null,
    snapshot: completeSnapshot,
    payments: [],
    signedContractsCount: 0,
    commissionLines: [],
    ...overrides,
  };
}

test("BOOTH commercial snapshot without real commitment allows recalculation path", () => {
  const args = commercialCommitmentArgs({
    snapshot: {
      ...completeSnapshot,
      giftVoucherId: null,
      passVoucherId: null,
      passConsumeId: null,
    },
  });

  assert.deepEqual(getCommercialCommitmentBlockers(args), []);
  assert.equal(hasCommercialRecalculationCommitment(args), false);
});

test("commercial snapshot with real payment blocks recalculation", () => {
  assert.deepEqual(
    getCommercialCommitmentBlockers(
      commercialCommitmentArgs({
        payments: [{ amountCents: 4_000, isDeposit: false, direction: "IN" }],
      })
    ),
    ["PAYMENT"]
  );
});

test("commercial snapshot with signed contract blocks recalculation", () => {
  assert.deepEqual(
    getCommercialCommitmentBlockers(
      commercialCommitmentArgs({
        signedContractsCount: 1,
      })
    ),
    ["SIGNED_CONTRACT"]
  );
});

test("commercial snapshot with voucher, pass, or gift blocks recalculation", () => {
  assert.deepEqual(
    getCommercialCommitmentBlockers(
      commercialCommitmentArgs({
        snapshot: { ...completeSnapshot, giftVoucherId: "gift_1" },
      })
    ),
    ["PREPAID_VOUCHER"]
  );

  assert.deepEqual(
    getCommercialCommitmentBlockers(
      commercialCommitmentArgs({
        snapshot: { ...completeSnapshot, passVoucherId: "pass_1" },
      })
    ),
    ["PREPAID_VOUCHER"]
  );

  assert.deepEqual(
    getCommercialCommitmentBlockers(
      commercialCommitmentArgs({
        snapshot: { ...completeSnapshot, passConsumeId: "consume_1" },
      })
    ),
    ["PREPAID_VOUCHER"]
  );
});

test("commercial snapshot with READY_FOR_PLATFORM status blocks recalculation", () => {
  assert.deepEqual(
    getCommercialCommitmentBlockers(
      commercialCommitmentArgs({
        status: "READY_FOR_PLATFORM",
      })
    ),
    ["OPERATIONAL_STATUS"]
  );
});

test("commercial snapshot with paid commission blocks recalculation", () => {
  assert.deepEqual(
    getCommercialCommitmentBlockers(
      commercialCommitmentArgs({
        commissionLines: [{ status: "PAID" }],
      })
    ),
    ["COMMISSION_PAID"]
  );
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

test("paid gift voucher formalization keeps service pending at zero even with stale live price", () => {
  const snapshot = {
    ...completeSnapshot,
    giftVoucherId: "gift_1",
    totalPriceCents: 12_000,
    appliedCommissionMode: null,
    items: [{ isExtra: false, unitPriceCents: 12_000, totalPriceCents: 12_000 }],
  };

  assert.equal(isReservationCoveredByPrepaidVoucher(snapshot), true);
  assert.equal(
    shouldPreserveFormalizeCommercialSnapshot({
      snapshot,
      payments: [],
      explicitRecalculate: true,
    }),
    true
  );

  const status = resolveReservationPaymentStatus({
    giftVoucherId: "gift_1",
    totalPriceCents: snapshot.totalPriceCents,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    items: [{ quantity: 1, isExtra: false, totalPriceCents: 12_000, service: { category: "JETSKI" } }],
    payments: [],
  });

  assert.equal(status.serviceDueCents, 0);
  assert.equal(status.pendingServiceCents, 0);
  assert.equal(status.state, "PAID");
});

test("paid pass voucher formalization keeps service pending at zero", () => {
  const status = resolveReservationPaymentStatus({
    passVoucherId: "pass_1",
    passConsumeId: "consume_1",
    totalPriceCents: 9_000,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    items: [{ quantity: 1, isExtra: false, totalPriceCents: 9_000, service: { category: "JETSKI" } }],
    payments: [],
  });

  assert.equal(status.serviceDueCents, 0);
  assert.equal(status.pendingServiceCents, 0);
  assert.equal(status.state, "PAID");
});

test("paid voucher update does not reopen service charge from stale main line", () => {
  assert.equal(
    resolveChargeableServiceDueCents({
      passVoucherId: "pass_1",
      totalPriceCents: 15_000,
      items: [{ isExtra: false, unitPriceCents: 15_000, totalPriceCents: 15_000 }],
    }),
    0
  );
});

test("paid voucher with extra charges only the extra", () => {
  const status = resolveReservationPaymentStatus({
    giftVoucherId: "gift_1",
    totalPriceCents: 15_000,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    items: [
      { quantity: 1, isExtra: false, totalPriceCents: 12_000, service: { category: "JETSKI" } },
      { quantity: 1, isExtra: true, totalPriceCents: 3_000, service: { category: "EXTRA" } },
    ],
    payments: [],
  });

  assert.equal(status.serviceDueCents, 3_000);
  assert.equal(status.pendingServiceCents, 3_000);
  assert.equal(status.state, "PENDING");
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
