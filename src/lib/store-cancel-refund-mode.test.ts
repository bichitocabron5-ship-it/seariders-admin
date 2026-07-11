import test from "node:test";
import assert from "node:assert/strict";

import {
  refundSelectionForStoreCancel,
  requestedRefundModeForStoreCancel,
} from "./store-cancel-refund-mode";

test("cancel refundMode SERVICE legacy solicita refundNow solo para servicio", () => {
  assert.deepEqual(refundSelectionForStoreCancel({ refundMode: "SERVICE" }), {
    requestedRefundMode: "refundNow",
    refundScope: "SERVICE",
  });
});

test("cancel refundMode FULL legacy solicita refundNow para servicio y fianza", () => {
  assert.deepEqual(refundSelectionForStoreCancel({ refundMode: "FULL" }), {
    requestedRefundMode: "refundNow",
    refundScope: "FULL",
  });
});

test("cancel requestedRefundMode moderno tiene prioridad sobre refundMode legacy", () => {
  assert.deepEqual(
    refundSelectionForStoreCancel({
      refundMode: "FULL",
      requestedRefundMode: "leavePendingRefund",
      refundScope: "DEPOSIT",
    }),
    {
      requestedRefundMode: "leavePendingRefund",
      refundScope: "DEPOSIT",
    }
  );
});

test("cancel refundMode NONE legacy no solicita devolucion", () => {
  assert.deepEqual(refundSelectionForStoreCancel({ refundMode: "NONE" }), {
    requestedRefundMode: "none",
    refundScope: "NONE",
  });
});

test("cancel requestedRefundMode compatible devuelve solo el modo", () => {
  assert.equal(requestedRefundModeForStoreCancel({ refundMode: "SERVICE" }), "refundNow");
});
