import test from "node:test";
import assert from "node:assert/strict";

import {
  computeCommissionableBase,
  computeCommissionableBaseFromScopedDiscount,
  proportionalCommissionBaseForCollected,
  resolveAppliedCommercialSnapshot,
  resolveDiscountPolicy,
} from "./commission";
import { finalizeReservationCommercialBreakdown } from "./reservation-commercial-breakdown";

test("computeCommissionableBase keeps gross commission base when company assumes discount", () => {
  const result = computeCommissionableBase({
    grossBaseCents: 10_000,
    totalDiscountCents: 1_000,
    responsibility: "COMPANY",
  });

  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 1_000);
});

test("computeCommissionableBase reduces commission base when promoter assumes full discount", () => {
  const result = computeCommissionableBase({
    grossBaseCents: 10_000,
    totalDiscountCents: 1_000,
    responsibility: "PROMOTER",
  });

  assert.equal(result.commissionBaseCents, 9_000);
  assert.equal(result.promoterDiscountCents, 1_000);
  assert.equal(result.companyDiscountCents, 0);
});

test("computeCommissionableBase supports shared discount with configurable promoter share", () => {
  const result = computeCommissionableBase({
    grossBaseCents: 10_000,
    totalDiscountCents: 1_000,
    responsibility: "SHARED",
    promoterDiscountShareBps: 2_500,
  });

  assert.equal(result.promoterDiscountCents, 250);
  assert.equal(result.companyDiscountCents, 750);
  assert.equal(result.commissionBaseCents, 9_750);
});

test("computeCommissionableBaseFromScopedDiscount allocates only the discount portion tied to the commissionable scope", () => {
  const result = computeCommissionableBaseFromScopedDiscount({
    grossBaseCents: 8_000,
    totalGrossCents: 10_000,
    totalDiscountCents: 1_000,
    responsibility: "PROMOTER",
  });

  assert.equal(result.discountCents, 800);
  assert.equal(result.commissionBaseCents, 7_200);
});

test("proportionalCommissionBaseForCollected preserves company-assumed discount uplift on partial payments", () => {
  const base = proportionalCommissionBaseForCollected({
    collectedNetCents: 4_500,
    reservationNetCents: 9_000,
    reservationCommissionBaseCents: 10_000,
  });

  assert.equal(base, 5_000);
});

test("resolveDiscountPolicy falls back to channel defaults", () => {
  const policy = resolveDiscountPolicy({
    channel: {
      discountResponsibility: "SHARED",
      promoterDiscountShareBps: 4_000,
    },
  });

  assert.equal(policy.discountResponsibility, "SHARED");
  assert.equal(policy.promoterDiscountShareBps, 4_000);
});

test("percentage commission uses the persisted commissionable base without discounts", () => {
  const commercial = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    manualDiscountCents: 0,
    discountResponsibility: "COMPANY",
  });

  const snapshot = resolveAppliedCommercialSnapshot({
    channel: {
      commissionEnabled: true,
      commissionPct: 20,
    },
    serviceId: "svc-1",
    commissionBaseCents: commercial.commissionBaseCents,
    customerDiscountBaseCents: commercial.totalBeforeDiscountsCents,
    quantity: 1,
  });

  assert.equal(snapshot.appliedCommissionMode, "PERCENT");
  assert.equal(snapshot.appliedCommissionPct, 20);
  assert.equal(snapshot.appliedCommissionCents, 2_000);
});

test("fixed commission keeps the configured amount even when the promoter discount changes the base", () => {
  const commercial = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    manualDiscountCents: 2_000,
    discountResponsibility: "PROMOTER",
  });

  const snapshot = resolveAppliedCommercialSnapshot({
    channel: {
      commissionEnabled: true,
      promoterCommissionMode: "FIXED",
      promoterCommissionCents: 1_500,
    },
    serviceId: "svc-1",
    commissionBaseCents: commercial.commissionBaseCents,
    customerDiscountBaseCents: commercial.totalBeforeDiscountsCents,
    quantity: 1,
  });

  assert.equal(commercial.commissionBaseCents, 8_000);
  assert.equal(snapshot.appliedCommissionMode, "FIXED");
  assert.equal(snapshot.appliedCommissionPct, null);
  assert.equal(snapshot.appliedCommissionCents, 1_500);
});

test("fixed customer discount does not change the fixed promoter commission amount", () => {
  const commercial = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 2_000,
    manualDiscountCents: 0,
    discountResponsibility: "PROMOTER",
  });

  const snapshot = resolveAppliedCommercialSnapshot({
    channel: {
      commissionEnabled: true,
      customerDiscountMode: "FIXED",
      customerDiscountCents: 2_000,
      promoterCommissionMode: "FIXED",
      promoterCommissionCents: 1_250,
    },
    serviceId: "svc-1",
    commissionBaseCents: commercial.commissionBaseCents,
    customerDiscountBaseCents: commercial.totalBeforeDiscountsCents,
    quantity: 1,
  });

  assert.equal(commercial.finalTotalCents, 8_000);
  assert.equal(commercial.commissionBaseCents, 8_000);
  assert.equal(commercial.promoterDiscountCents, 2_000);
  assert.equal(commercial.companyDiscountCents, 0);
  assert.equal(snapshot.appliedCommissionMode, "FIXED");
  assert.equal(snapshot.appliedCommissionCents, 1_250);
  assert.equal(Math.max(0, commercial.finalTotalCents - snapshot.appliedCommissionCents), 6_750);
});

test("percentage commission keeps gross base when company assumes the discount", () => {
  const commercial = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_000,
    manualDiscountCents: 0,
    discountResponsibility: "COMPANY",
  });

  const snapshot = resolveAppliedCommercialSnapshot({
    channel: {
      commissionEnabled: true,
      commissionPct: 10,
    },
    serviceId: "svc-1",
    commissionBaseCents: commercial.commissionBaseCents,
    customerDiscountBaseCents: commercial.totalBeforeDiscountsCents,
    quantity: 1,
  });

  assert.equal(commercial.commissionBaseCents, 10_000);
  assert.equal(snapshot.appliedCommissionMode, "PERCENT");
  assert.equal(snapshot.appliedCommissionCents, 1_000);
});

test("percentage commission drops to final charged amount when promoter assumes the discount", () => {
  const commercial = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_000,
    manualDiscountCents: 0,
    discountResponsibility: "PROMOTER",
  });

  const snapshot = resolveAppliedCommercialSnapshot({
    channel: {
      commissionEnabled: true,
      commissionPct: 10,
    },
    serviceId: "svc-1",
    commissionBaseCents: commercial.commissionBaseCents,
    customerDiscountBaseCents: commercial.totalBeforeDiscountsCents,
    quantity: 1,
  });

  assert.equal(commercial.commissionBaseCents, 9_000);
  assert.equal(snapshot.appliedCommissionMode, "PERCENT");
  assert.equal(snapshot.appliedCommissionCents, 900);
});
