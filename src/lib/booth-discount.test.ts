import test from "node:test";
import assert from "node:assert/strict";

import { getBoothUnitDiscountCents, getScaledBoothDiscountCents } from "./booth-discount";

test("getBoothUnitDiscountCents returns 0 for non-booth reservations", () => {
  assert.equal(
    getBoothUnitDiscountCents({
      source: "STORE",
      matchingQuantity: 2,
      manualDiscountCents: 2000,
    }),
    0
  );
});

test("getBoothUnitDiscountCents derives per-unit discount from original booth line", () => {
  assert.equal(
    getBoothUnitDiscountCents({
      source: "BOOTH",
      matchingQuantity: 2,
      manualDiscountCents: 2000,
    }),
    1000
  );
});

test("getScaledBoothDiscountCents scales booth discount only with matching quantity", () => {
  assert.equal(
    getScaledBoothDiscountCents({
      boothUnitDiscountCents: 1000,
      nextMatchingQuantity: 3,
    }),
    3000
  );
});

test("getScaledBoothDiscountCents returns 0 when there is no matching booth line", () => {
  assert.equal(
    getScaledBoothDiscountCents({
      boothUnitDiscountCents: 1000,
      nextMatchingQuantity: 0,
    }),
    0
  );
});
