import test from "node:test";
import assert from "node:assert/strict";

import {
  type CommercialAdjustmentPreviewClient,
  type CommercialAdjustmentPreviewReservation,
  buildCommercialAdjustmentPreview,
  readCommercialAdjustmentPreview,
} from "./commercial-adjustment-preview";

function baseReservation(
  overrides: Partial<CommercialAdjustmentPreviewReservation> = {}
): CommercialAdjustmentPreviewReservation {
  return {
    id: "res_1",
    status: "WAITING",
    totalPriceCents: 10_000,
    depositCents: 0,
    giftVoucherId: null,
    passVoucherId: null,
    passConsumeId: null,
    quantity: 1,
    isLicense: false,
    service: { category: "JETSKI" },
    items: [
      {
        quantity: 1,
        isExtra: false,
        totalPriceCents: 10_000,
        service: { category: "JETSKI" },
      },
    ],
    payments: [],
    contracts: [],
    commissionLines: [],
    ...overrides,
  };
}

test("preview read only calls reservation.findUnique", async () => {
  const calls: string[] = [];
  const reservationDelegate = new Proxy(
    {
      async findUnique() {
        calls.push("reservation.findUnique");
        return baseReservation();
      },
    },
    {
      get(target, property, receiver) {
        if (property in target) return Reflect.get(target, property, receiver);
        throw new Error(`Unexpected Prisma write/read method: ${String(property)}`);
      },
    }
  );
  const client = { reservation: reservationDelegate } as unknown as CommercialAdjustmentPreviewClient;

  const preview = await readCommercialAdjustmentPreview(client, "res_1", {
    newTotalCents: 12_000,
    operationType: "EDIT",
    requestedRefundMode: "none",
    reason: "Cambio de precio",
  });

  assert.deepEqual(calls, ["reservation.findUnique"]);
  assert.equal(preview?.oldTotalCents, 10_000);
  assert.equal(preview?.newTotalCents, 12_000);
});

test("sin pagos permite ajuste normal", () => {
  const preview = buildCommercialAdjustmentPreview(baseReservation(), {
    newTotalCents: 12_000,
    operationType: "EDIT",
    requestedRefundMode: "none",
    reason: "Cambio comercial",
  });

  assert.equal(preview.canCommit, true);
  assert.deepEqual(preview.blockers, []);
  assert.equal(preview.oldTotalCents, 10_000);
  assert.equal(preview.newTotalCents, 12_000);
  assert.equal(preview.paidServiceCents, 0);
  assert.equal(preview.pendingServiceCents, 12_000);
  assert.equal(preview.overpaidServiceCents, 0);
});

test("pago parcial y newTotal mayor deja pendiente", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      payments: [{ amountCents: 5_000, isDeposit: false, direction: "IN" }],
    }),
    {
      newTotalCents: 15_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
      reason: "Ampliacion",
    }
  );

  assert.equal(preview.canCommit, true);
  assert.equal(preview.paidServiceCents, 5_000);
  assert.equal(preview.pendingServiceCents, 10_000);
  assert.equal(preview.overpaidServiceCents, 0);
  assert.ok(preview.requiredActions.includes("COLLECT_PENDING_SERVICE"));
});

test("pago total y newTotal menor devuelve overpaid", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      payments: [{ amountCents: 10_000, isDeposit: false, direction: "IN" }],
    }),
    {
      newTotalCents: 8_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
      reason: "Reduccion",
    }
  );

  assert.equal(preview.canCommit, false);
  assert.equal(preview.pendingServiceCents, 0);
  assert.equal(preview.overpaidServiceCents, 2_000);
  assert.ok(preview.blockers.includes("REFUND_MODE_REQUIRED"));
});

test("refundNow devuelve refundNowCents", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      payments: [{ amountCents: 10_000, isDeposit: false, direction: "IN" }],
    }),
    {
      newTotalCents: 8_000,
      operationType: "EDIT",
      requestedRefundMode: "refundNow",
      reason: "Devolucion aprobada",
    }
  );

  assert.equal(preview.canCommit, true);
  assert.equal(preview.refundNowCents, 2_000);
  assert.equal(preview.pendingRefundCents, 0);
  assert.ok(preview.requiredActions.includes("REFUND_NOW"));
});

test("leavePendingRefund devuelve pendingRefundCents", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      payments: [{ amountCents: 10_000, isDeposit: false, direction: "IN" }],
    }),
    {
      newTotalCents: 8_000,
      operationType: "EDIT",
      requestedRefundMode: "leavePendingRefund",
      reason: "Pendiente de devolucion",
    }
  );

  assert.equal(preview.canCommit, true);
  assert.equal(preview.refundNowCents, 0);
  assert.equal(preview.pendingRefundCents, 2_000);
  assert.ok(preview.requiredActions.includes("LEAVE_PENDING_REFUND"));
});

test("voucher pass o gift bloquea", () => {
  for (const reservation of [
    baseReservation({ giftVoucherId: "gift_1" }),
    baseReservation({ passVoucherId: "pass_1" }),
    baseReservation({ passConsumeId: "consume_1" }),
  ]) {
    const preview = buildCommercialAdjustmentPreview(reservation, {
      newTotalCents: 9_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
      reason: "Ajuste",
    });

    assert.equal(preview.canCommit, false);
    assert.ok(preview.blockers.includes("VOUCHER_OR_PASS_OR_GIFT"));
  }
});

test("comision PAID bloquea", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      commissionLines: [{ status: "PAID" }],
    }),
    {
      newTotalCents: 9_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
      reason: "Ajuste",
    }
  );

  assert.equal(preview.canCommit, false);
  assert.ok(preview.blockers.includes("PAID_COMMISSION"));
});

test("SIGNED con EDIT material bloquea", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      contracts: [
        {
          unitIndex: 1,
          logicalUnitIndex: 1,
          status: "SIGNED",
          supersededAt: null,
          createdAt: new Date("2026-01-01T10:00:00.000Z"),
        },
      ],
    }),
    {
      newTotalCents: 9_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
      reason: "Ajuste",
    }
  );

  assert.equal(preview.canCommit, false);
  assert.ok(preview.blockers.includes("SIGNED_CONTRACT_MATERIAL_EDIT"));
});

test("SIGNED con CANCEL permite si la politica lo permite", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      contracts: [
        {
          unitIndex: 1,
          logicalUnitIndex: 1,
          status: "SIGNED",
          supersededAt: null,
          createdAt: new Date("2026-01-01T10:00:00.000Z"),
        },
      ],
    }),
    {
      newTotalCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "none",
      reason: "Cancelacion comercial",
    }
  );

  assert.equal(preview.canCommit, true);
  assert.deepEqual(preview.blockers, []);
  assert.ok(preview.warnings.includes("SIGNED_CONTRACT_HISTORY_PRESERVED"));
  assert.ok(preview.requiredActions.includes("KEEP_SIGNED_CONTRACT_HISTORY"));
});

test("CANCEL con servicio y fianza pagados previsualiza devoluciones separadas", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      depositCents: 5_000,
      payments: [
        { amountCents: 10_000, isDeposit: false, direction: "IN" },
        { amountCents: 5_000, isDeposit: true, direction: "IN" },
      ],
    }),
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      reason: "Cancelacion con devolucion completa",
    }
  );

  assert.equal(preview.canCommit, true);
  assert.equal(preview.refundableServiceCents, 10_000);
  assert.equal(preview.refundableDepositCents, 5_000);
  assert.equal(preview.serviceRefundNowCents, 10_000);
  assert.equal(preview.depositRefundNowCents, 5_000);
  assert.equal(preview.refundNowCents, 15_000);
});

test("CANCEL con fianza retenida previsualiza warning explicito", () => {
  const preview = buildCommercialAdjustmentPreview(
    baseReservation({
      depositCents: 5_000,
      depositHeld: true,
      payments: [{ amountCents: 5_000, isDeposit: true, direction: "IN" }],
    }),
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      reason: "Cancelacion con fianza retenida",
    }
  );

  assert.equal(preview.canCommit, true);
  assert.equal(preview.depositRefundNowCents, 0);
  assert.equal(preview.depositRefundHeldCents, 5_000);
  assert.equal(preview.depositRefundBlockedReason, "DEPOSIT_HELD");
  assert.ok(preview.warnings.includes("DEPOSIT_HELD_NOT_REFUNDED"));
});
