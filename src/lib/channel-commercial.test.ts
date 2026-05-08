import assert from "node:assert/strict";
import test from "node:test";
import { resolveChannelCommercialPatch } from "./channel-commercial";

test("resolveChannelCommercialPatch recalculates fixed customer discount cents without requiring mode in patch", () => {
  const result = resolveChannelCommercialPatch(
    {
      customerDiscountMode: "FIXED",
      customerDiscountValue: 10,
      customerDiscountCents: 1000,
    },
    {
      customerDiscountValue: 12.5,
    }
  );

  assert.equal(result.customerDiscountCents, 1250);
});

test("resolveChannelCommercialPatch resets customer discount cents for percent mode value updates", () => {
  const result = resolveChannelCommercialPatch(
    {
      customerDiscountMode: "PERCENT",
      customerDiscountValue: 5,
      customerDiscountCents: 500,
    },
    {
      customerDiscountValue: 7.5,
    }
  );

  assert.equal(result.customerDiscountCents, 0);
});

test("resolveChannelCommercialPatch recalculates fixed promoter commission cents without requiring mode in patch", () => {
  const result = resolveChannelCommercialPatch(
    {
      promoterCommissionMode: "FIXED",
      promoterCommissionValue: 8,
      promoterCommissionCents: 800,
    },
    {
      promoterCommissionValue: 9.75,
    }
  );

  assert.equal(result.promoterCommissionCents, 975);
});
