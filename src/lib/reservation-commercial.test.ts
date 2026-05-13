import test from "node:test";
import assert from "node:assert/strict";

import { computeReservationCommercialBreakdown } from "./reservation-commercial";

test("manual discount with COMPANY responsibility does not reduce promoter commission base", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    manualDiscountCents: 1_500,
    discountResponsibility: "COMPANY",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 8_500);
  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 1_500);
});

test("manual discount with PROMOTER responsibility reduces promoter commission base", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    manualDiscountCents: 1_500,
    discountResponsibility: "PROMOTER",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 8_500);
  assert.equal(result.commissionBaseCents, 8_500);
  assert.equal(result.promoterDiscountCents, 1_500);
  assert.equal(result.companyDiscountCents, 0);
});

test("manual discount with SHARED responsibility reduces only promoter share from commission base", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    manualDiscountCents: 1_500,
    discountResponsibility: "SHARED",
    promoterDiscountShareBps: 4_000,
  });

  assert.equal(result.finalTotalCents, 8_500);
  assert.equal(result.commissionBaseCents, 9_400);
  assert.equal(result.promoterDiscountCents, 600);
  assert.equal(result.companyDiscountCents, 900);
});
