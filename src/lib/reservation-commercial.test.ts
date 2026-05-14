import test from "node:test";
import assert from "node:assert/strict";

import {
  computeReservationCommercialBreakdown,
} from "./reservation-commercial";
import { finalizeReservationCommercialBreakdown } from "./reservation-commercial-breakdown";

test("no discount keeps final total and commission base on the gross price", () => {
  const result = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    autoDiscountCents: 0,
    manualDiscountCents: 0,
    discountResponsibility: "COMPANY",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 10_000);
  assert.equal(result.totalDiscountCents, 0);
  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 0);
});

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

test("channel or automatic discounts do not reduce promoter commission base by themselves", () => {
  const result = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_500,
    autoDiscountCents: 500,
    manualDiscountCents: 0,
    discountResponsibility: "PROMOTER",
    promoterDiscountShareBps: 10_000,
  });

  assert.equal(result.finalTotalCents, 8_000);
  assert.equal(result.totalDiscountCents, 2_000);
  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 0);
});
