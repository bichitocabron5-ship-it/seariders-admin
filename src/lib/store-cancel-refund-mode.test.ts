import test from "node:test";
import assert from "node:assert/strict";

import { requestedRefundModeForStoreCancel } from "./store-cancel-refund-mode";

test("cancel refundMode FULL legacy solicita refundNow", () => {
  assert.equal(requestedRefundModeForStoreCancel({ refundMode: "FULL" }), "refundNow");
});

test("cancel requestedRefundMode moderno tiene prioridad sobre refundMode legacy", () => {
  assert.equal(
    requestedRefundModeForStoreCancel({
      refundMode: "FULL",
      requestedRefundMode: "leavePendingRefund",
    }),
    "leavePendingRefund"
  );
});

test("cancel refundMode NONE legacy deja devolucion pendiente", () => {
  assert.equal(requestedRefundModeForStoreCancel({ refundMode: "NONE" }), "leavePendingRefund");
});
