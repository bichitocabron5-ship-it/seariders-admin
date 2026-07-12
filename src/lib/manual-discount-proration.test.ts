import test from "node:test";
import assert from "node:assert/strict";

import {
  prorateManualDiscountCents,
  resolveManualDiscountCentsForQuantityChange,
  resolveManualDiscountReasonForPersistence,
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

test("explicit manual discount with a new reason persists both values", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 0,
      oldQuantity: 1,
      newQuantity: 1,
      newSubtotalCents: 10_000,
      explicitManualDiscountCents: 1_500,
    }),
    1_500
  );
  assert.equal(
    resolveManualDiscountReasonForPersistence({
      currentManualDiscountReason: "motivo anterior",
      explicitManualDiscountCents: 1_500,
      manualDiscountReason: "motivo nuevo",
    }),
    "motivo nuevo"
  );
});

test("explicit manual discount change without a reason preserves the existing reason", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 1_000,
      oldQuantity: 1,
      newQuantity: 1,
      newSubtotalCents: 10_000,
      explicitManualDiscountCents: 2_000,
    }),
    2_000
  );
  assert.equal(
    resolveManualDiscountReasonForPersistence({
      currentManualDiscountReason: "motivo existente",
      explicitManualDiscountCents: 2_000,
    }),
    "motivo existente"
  );
});

test("explicit zero or null manual discount clears discount reason", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 1_000,
      oldQuantity: 1,
      newQuantity: 1,
      newSubtotalCents: 10_000,
      explicitManualDiscountCents: 0,
    }),
    0
  );
  assert.equal(
    resolveManualDiscountReasonForPersistence({
      currentManualDiscountReason: "motivo residual",
      explicitManualDiscountCents: 0,
      manualDiscountReason: "ignorado",
    }),
    null
  );
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 1_000,
      oldQuantity: 1,
      newQuantity: 1,
      newSubtotalCents: 10_000,
      explicitManualDiscountCents: null,
    }),
    0
  );
  assert.equal(
    resolveManualDiscountReasonForPersistence({
      currentManualDiscountReason: "motivo residual",
      explicitManualDiscountCents: null,
    }),
    null
  );
});

test("quantity changes without explicit manual discount prorate discount and preserve reason", () => {
  assert.equal(
    resolveManualDiscountCentsForQuantityChange({
      currentManualDiscountCents: 1_000,
      oldQuantity: 1,
      newQuantity: 2,
      newSubtotalCents: 10_000,
    }),
    2_000
  );
  assert.equal(
    resolveManualDiscountReasonForPersistence({
      currentManualDiscountReason: "motivo existente",
      manualDiscountReason: "motivo ignorado",
    }),
    "motivo existente"
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
