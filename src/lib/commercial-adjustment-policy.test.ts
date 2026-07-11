import test from "node:test";
import assert from "node:assert/strict";

import {
  type ResolveCommercialAdjustmentPolicyArgs,
  resolveCommercialAdjustmentPolicy,
} from "./commercial-adjustment-policy";

function basePolicyArgs(
  overrides: Partial<ResolveCommercialAdjustmentPolicyArgs> = {}
): ResolveCommercialAdjustmentPolicyArgs {
  return {
    oldTotalCents: 10_000,
    newTotalCents: 10_000,
    paidServiceCents: 0,
    paidDepositCents: 0,
    hasSignedContracts: false,
    reservationStatus: "WAITING",
    hasPaidCommission: false,
    hasPendingCommission: false,
    hasVoucherOrPassOrGift: false,
    requestedRefundMode: null,
    reason: null,
    operationType: "EDIT",
    ...overrides,
  };
}

test("sin pago permite cambiar total y recalcular normal", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 12_000,
    })
  );

  assert.equal(policy.canCommit, true);
  assert.deepEqual(policy.blockers, []);
  assert.equal(policy.pendingServiceCents, 12_000);
  assert.equal(policy.overpaidServiceCents, 0);
  assert.deepEqual(policy.requiredActions, [
    "RECALCULATE_COMMERCIAL_TOTAL",
    "COLLECT_PENDING_SERVICE",
  ]);
});

test("pago parcial y nuevo total mayor deja pendiente de cobro", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 15_000,
      paidServiceCents: 5_000,
    })
  );

  assert.equal(policy.canCommit, true);
  assert.equal(policy.pendingServiceCents, 10_000);
  assert.equal(policy.overpaidServiceCents, 0);
  assert.equal(policy.refundNowCents, 0);
  assert.ok(policy.warnings.includes("PAYMENT_HISTORY_PRESERVED"));
  assert.ok(policy.requiredActions.includes("KEEP_PAYMENT_HISTORY"));
  assert.ok(policy.requiredActions.includes("COLLECT_PENDING_SERVICE"));
});

test("pago parcial y nuevo total menor con refundNow calcula devolucion inmediata", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 3_000,
      paidServiceCents: 5_000,
      requestedRefundMode: "refundNow",
      reason: "Ajuste comercial aprobado",
    })
  );

  assert.equal(policy.canCommit, true);
  assert.equal(policy.pendingServiceCents, 0);
  assert.equal(policy.overpaidServiceCents, 2_000);
  assert.equal(policy.refundNowCents, 2_000);
  assert.equal(policy.pendingRefundCents, 0);
  assert.ok(policy.requiredActions.includes("REFUND_NOW"));
});

test("pago parcial y nuevo total menor con leavePendingRefund deja devolucion pendiente", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 3_000,
      paidServiceCents: 5_000,
      requestedRefundMode: "leavePendingRefund",
    })
  );

  assert.equal(policy.canCommit, true);
  assert.equal(policy.pendingServiceCents, 0);
  assert.equal(policy.overpaidServiceCents, 2_000);
  assert.equal(policy.refundNowCents, 0);
  assert.equal(policy.pendingRefundCents, 2_000);
  assert.ok(policy.requiredActions.includes("LEAVE_PENDING_REFUND"));
});

test("pago total y nuevo total menor requiere elegir politica de devolucion", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 8_000,
      paidServiceCents: 10_000,
    })
  );

  assert.equal(policy.canCommit, false);
  assert.equal(policy.overpaidServiceCents, 2_000);
  assert.deepEqual(policy.blockers, ["REFUND_MODE_REQUIRED"]);
});

test("EDIT con sobrepago de servicio y alcance DEPOSIT bloquea", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 8_000,
      paidServiceCents: 10_000,
      requestedRefundMode: "refundNow",
      refundScope: "DEPOSIT",
      reason: "Devolucion aprobada",
      operationType: "EDIT",
    })
  );

  assert.equal(policy.canCommit, false);
  assert.equal(policy.overpaidServiceCents, 2_000);
  assert.deepEqual(policy.blockers, ["REFUND_SCOPE_INCOMPATIBLE"]);
  assert.equal(policy.refundNowCents, 0);
  assert.equal(policy.pendingRefundCents, 0);
});

test("EDIT sin sobrepago de servicio permite alcance DEPOSIT", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 12_000,
      paidServiceCents: 10_000,
      refundScope: "DEPOSIT",
      operationType: "EDIT",
    })
  );

  assert.equal(policy.canCommit, true);
  assert.equal(policy.overpaidServiceCents, 0);
  assert.deepEqual(policy.blockers, []);
});

test("CANCEL con alcance sin servicio no exige modo por sobrepago de servicio", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 0,
      paidServiceCents: 10_000,
      refundScope: "DEPOSIT",
      operationType: "CANCEL",
      reason: "Cancelacion sin devolver servicio",
    })
  );

  assert.equal(policy.canCommit, true);
  assert.equal(policy.overpaidServiceCents, 10_000);
  assert.deepEqual(policy.blockers, []);
  assert.equal(policy.refundNowCents, 0);
  assert.equal(policy.pendingRefundCents, 0);
});

test("contrato SIGNED con EDIT bloquea cambios materiales", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 9_000,
      hasSignedContracts: true,
      operationType: "EDIT",
    })
  );

  assert.equal(policy.canCommit, false);
  assert.ok(policy.blockers.includes("SIGNED_CONTRACT_MATERIAL_EDIT"));
});

test("contrato SIGNED con CANCEL permite cancelar conservando historico", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 0,
      hasSignedContracts: true,
      operationType: "CANCEL",
      reason: "Cancelacion comercial",
    })
  );

  assert.equal(policy.canCommit, true);
  assert.deepEqual(policy.blockers, []);
  assert.ok(policy.warnings.includes("SIGNED_CONTRACT_HISTORY_PRESERVED"));
  assert.ok(policy.requiredActions.includes("KEEP_SIGNED_CONTRACT_HISTORY"));
});

test("CANCEL sin motivo bloquea incluso sin devolucion", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 0,
      operationType: "CANCEL",
      reason: "   ",
    })
  );

  assert.equal(policy.canCommit, false);
  assert.ok(policy.blockers.includes("CANCEL_REASON_REQUIRED"));
});

test("comision PAID bloquea el ajuste normal", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 9_000,
      hasPaidCommission: true,
      requestedRefundMode: "leavePendingRefund",
    })
  );

  assert.equal(policy.canCommit, false);
  assert.ok(policy.blockers.includes("PAID_COMMISSION"));
});

test("estado operativo avanzado bloquea el flujo normal", () => {
  for (const reservationStatus of ["IN_SEA", "COMPLETED", "CANCELED"]) {
    const policy = resolveCommercialAdjustmentPolicy(
      basePolicyArgs({
        reservationStatus,
      })
    );

    assert.equal(policy.canCommit, false);
    assert.deepEqual(policy.blockers, ["ADVANCED_RESERVATION_STATUS"]);
  }
});

test("refundNow sin motivo bloquea", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 3_000,
      paidServiceCents: 5_000,
      requestedRefundMode: "refundNow",
      reason: "   ",
    })
  );

  assert.equal(policy.canCommit, false);
  assert.equal(policy.refundNowCents, 2_000);
  assert.deepEqual(policy.blockers, ["REFUND_REASON_REQUIRED"]);
});

test("refundNow bloquea en fase B3A", () => {
  const policy = resolveCommercialAdjustmentPolicy(
    basePolicyArgs({
      oldTotalCents: 10_000,
      newTotalCents: 8_000,
      paidServiceCents: 10_000,
      requestedRefundMode: "refundNow",
      reason: "Devolucion aprobada",
      phase: "B3A",
    })
  );

  assert.equal(policy.canCommit, false);
  assert.equal(policy.refundNowCents, 2_000);
  assert.deepEqual(policy.blockers, ["REFUND_NOW_NOT_SUPPORTED_B3A"]);
});
