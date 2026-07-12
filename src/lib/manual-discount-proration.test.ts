import test from "node:test";
import assert from "node:assert/strict";

import {
  prorateManualDiscountCents,
  resolveManualDiscountCentsForQuantityChange,
  sumMainReservationQuantity,
} from "./manual-discount-proration";

test("2 -> 1 prorates manual discount by unit", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 4_000,
      oldQuantity: 2,
      newQuantity: 1,
      newSubtotalCents: 10_000,
    }),
    2_000
  );
});

test("1 -> 2 applies same manual discount per unit to added units", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 2_000,
      oldQuantity: 1,
      newQuantity: 2,
      newSubtotalCents: 20_000,
    }),
    4_000
  );
});

test("explicit manual discount wins over prorated value", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 4_000,
      oldQuantity: 2,
      newQuantity: 1,
      newSubtotalCents: 10_000,
      explicitManualDiscountCents: 1_500,
    }),
    1_500
  );
});

test("non exact division rounds deterministically half up", () => {
  assert.equal(prorateManualDiscountCents({ oldManualDiscountCents: 1_000, oldQuantity: 3, newQuantity: 1 }), 333);
  assert.equal(prorateManualDiscountCents({ oldManualDiscountCents: 1_000, oldQuantity: 3, newQuantity: 2 }), 667);
});

test("manual discount is capped at new subtotal", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 50_000,
      oldQuantity: 1,
      newQuantity: 2,
      newSubtotalCents: 40_000,
    }),
    40_000
  );
});

test("sumMainReservationQuantity ignores extras and falls back to reservation quantity", () => {
  assert.equal(
    sumMainReservationQuantity(
      [
        { quantity: 2, isExtra: false },
        { quantity: 4, isExtra: true },
      ],
      9
    ),
    2
  );
  assert.equal(sumMainReservationQuantity([{ quantity: 4, isExtra: true }], 3), 3);
});
