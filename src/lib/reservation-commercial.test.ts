import test from "node:test";
import assert from "node:assert/strict";

import { computeReservationCommercialBreakdown } from "./reservation-commercial";

test("manual discount reduces commission base down to final price", async () => {
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
  assert.equal(result.commissionBaseCents, 8_500);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 1_500);
});
