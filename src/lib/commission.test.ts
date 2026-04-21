import test from "node:test";
import assert from "node:assert/strict";

import {
  computeCommissionableBase,
  computeCommissionableBaseFromScopedDiscount,
  proportionalCommissionBaseForCollected,
  resolveDiscountPolicy,
} from "./commission";

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
