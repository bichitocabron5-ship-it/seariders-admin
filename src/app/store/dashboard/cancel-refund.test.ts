import test from "node:test";
import assert from "node:assert/strict";

import { resolveCancelRefundSubmit } from "./cancel-refund";

test("dashboard cancel solo fianza pagada y refundNow envia DEPOSIT", () => {
  assert.deepEqual(
    resolveCancelRefundSubmit({
      selectedRefundMode: "refundNow",
      refundableServiceCents: 0,
      refundableDepositCents: 5_000,
    }),
    {
      requestedRefundMode: "refundNow",
      refundScope: "DEPOSIT",
    }
  );
});

test("dashboard cancel solo servicio pagado y refundNow envia SERVICE", () => {
  assert.deepEqual(
    resolveCancelRefundSubmit({
      selectedRefundMode: "refundNow",
      refundableServiceCents: 10_000,
      refundableDepositCents: 0,
    }),
    {
      requestedRefundMode: "refundNow",
      refundScope: "SERVICE",
    }
  );
});

test("dashboard cancel servicio y fianza pagados envia FULL", () => {
  assert.deepEqual(
    resolveCancelRefundSubmit({
      selectedRefundMode: "refundNow",
      refundableServiceCents: 10_000,
      refundableDepositCents: 5_000,
    }),
    {
      requestedRefundMode: "refundNow",
      refundScope: "FULL",
    }
  );
});

test("dashboard cancel leavePendingRefund con solo fianza envia DEPOSIT", () => {
  assert.deepEqual(
    resolveCancelRefundSubmit({
      selectedRefundMode: "leavePendingRefund",
      refundableServiceCents: 0,
      refundableDepositCents: 5_000,
    }),
    {
      requestedRefundMode: "leavePendingRefund",
      refundScope: "DEPOSIT",
    }
  );
});

test("dashboard cancel sin importe reembolsable no exige modo", () => {
  assert.deepEqual(
    resolveCancelRefundSubmit({
      selectedRefundMode: "refundNow",
      refundableServiceCents: 0,
      refundableDepositCents: 0,
    }),
    {
      requestedRefundMode: "none",
      refundScope: "FULL",
    }
  );
});
