import test from "node:test";
import assert from "node:assert/strict";
import { PaymentMethod, PaymentOrigin } from "@prisma/client";

import {
  CommercialAdjustmentCommitBlockedError,
  commitCommercialAdjustment,
} from "./commercial-adjustment-commit";
import { resolveReservationPaymentStatus } from "./reservation-payment-status";
import { refundSelectionForStoreCancel } from "./store-cancel-refund-mode";

type PaymentRow = {
  id: string;
  amountCents: number;
  isDeposit: boolean;
  direction: "IN" | "OUT";
  origin?: string | null;
  method?: string | null;
  customerName?: string | null;
  createdByUserId?: string | null;
  shiftSessionId?: string | null;
  description?: string | null;
  notes?: string | null;
};

type ItemRow = {
  id: string;
  quantity: number;
  isExtra: boolean;
  totalPriceCents: number;
  unitPriceCents: number;
  service: { category: string | null };
};

type ContractRow = {
  id: string;
  reservationId: string;
  unitIndex: number;
  logicalUnitIndex: number | null;
  status: "DRAFT" | "READY" | "SIGNED" | "VOID";
  supersededAt: Date | null;
  createdAt: Date;
  templateCode: string | null;
  templateVersion: string | null;
  renderedHtml: string | null;
  renderedPdfKey: string | null;
  renderedPdfUrl: string | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  preparedJetskiId: string | null;
  preparedAssetId: string | null;
  preparedAssetType: string | null;
};

type CommissionLineRow = {
  id: string;
  channelId: string;
  reservationId: string | null;
  paymentId: string | null;
  serviceId: string | null;
  status: "PENDING" | "PAID" | "VOIDED";
  commissionCents: number;
  notes: string | null;
};

function baseContract(
  id: string,
  status: ContractRow["status"],
  logicalUnitIndex: number
): ContractRow {
  return {
    id,
    reservationId: "res_1",
    unitIndex: logicalUnitIndex,
    logicalUnitIndex,
    status,
    supersededAt: null,
    createdAt: new Date(`2026-07-01T10:0${logicalUnitIndex}:00.000Z`),
    templateCode: "JETSKI_NO_LICENSE",
    templateVersion: null,
    renderedHtml: null,
    renderedPdfKey: null,
    renderedPdfUrl: null,
    licenseSchool: null,
    licenseType: null,
    licenseNumber: null,
    preparedJetskiId: null,
    preparedAssetId: null,
    preparedAssetType: null,
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  const reservation = {
    id: "res_1",
    source: "STORE",
    status: "WAITING",
    totalPriceCents: 10_000,
    depositCents: 0,
    giftVoucherId: null,
    passVoucherId: null,
    passConsumeId: null,
    serviceId: "svc_1",
    channelId: null,
    quantity: 1,
    isLicense: false,
    service: { category: "JETSKI" },
    customerName: "Ada Lovelace",
    createdAt: new Date("2026-07-01T09:00:00.000Z"),
    basePriceCents: 10_000,
    commissionBaseCents: 10_000,
    appliedCommissionPct: null,
    appliedCommissionMode: "PERCENT",
    appliedCommissionValue: 0,
    appliedCommissionCents: 0,
    items: [
      {
        id: "item_1",
        quantity: 1,
        isExtra: false,
        totalPriceCents: 10_000,
        unitPriceCents: 10_000,
        service: { category: "JETSKI" },
      },
    ] as ItemRow[],
    payments: [] as PaymentRow[],
    contracts: [] as ContractRow[],
    commissionLines: [] as CommissionLineRow[],
    units: [] as Array<{ id: string; status: string; readyForPlatformAt: Date | null; jetskiId: string | null }>,
    ...overrides,
  };

  const paymentMutations: string[] = [];
  const paymentCreates: PaymentRow[] = [];
  const channel = {
    id: "ch_1",
    kind: "STANDARD",
    commissionEnabled: true,
    commissionBps: null,
    commissionPct: 10,
    promoterCommissionMode: "PERCENT",
    promoterCommissionValue: 10,
    promoterCommissionCents: null,
    customerDiscountMode: "PERCENT",
    customerDiscountValue: 0,
    customerDiscountCents: 0,
    commissionRules: [],
  };

  const tx = {
    $queryRaw: async () => [{ ok: 1 }],
    reservation: {
      findUnique: async () => reservation,
      update: async (args: { data: Record<string, unknown> }) => {
        Object.assign(reservation, args.data);
        return { id: reservation.id, status: reservation.status };
      },
    },
    reservationItem: {
      update: async (args: { where: { id: string }; data: Partial<ItemRow> }) => {
        const item = reservation.items.find((candidate) => candidate.id === args.where.id);
        if (!item) throw new Error("Item not found");
        Object.assign(item, args.data);
        return item;
      },
    },
    reservationContract: {
      findMany: async () =>
        reservation.contracts.map((contract) => ({
          ...contract,
          preparedAsset: contract.preparedAssetId ? { type: contract.preparedAssetType } : null,
        })),
      update: async (args: { where: { id: string }; data: Partial<ContractRow> }) => {
        const contract = reservation.contracts.find((candidate) => candidate.id === args.where.id);
        if (!contract) throw new Error("Contract not found");
        Object.assign(contract, args.data);
        return { id: contract.id };
      },
      updateMany: async (args: { where: { id: { in: string[] } }; data: Partial<ContractRow> }) => {
        let count = 0;
        for (const contract of reservation.contracts) {
          if (!args.where.id.in.includes(contract.id)) continue;
          Object.assign(contract, args.data);
          count += 1;
        }
        return { count };
      },
      createMany: async (args: {
        data: Array<{
          reservationId: string;
          unitIndex: number;
          logicalUnitIndex: number;
          templateCode?: string | null;
        }>;
      }) => {
        for (const item of args.data) {
          reservation.contracts.push({
            ...baseContract(`created_${item.logicalUnitIndex}`, "DRAFT", item.logicalUnitIndex),
            reservationId: item.reservationId,
            unitIndex: item.unitIndex,
            templateCode: item.templateCode ?? null,
          });
        }
        return { count: args.data.length };
      },
    },
    reservationUnit: {
      updateMany: async (args: { where: { reservationId: string; status?: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const unit of reservation.units) {
          if (args.where.status && unit.status !== args.where.status) continue;
          Object.assign(unit, args.data);
          count += 1;
        }
        return { count };
      },
    },
    channel: {
      findUnique: async (args: { where: { id: string } }) =>
        args.where.id === channel.id ? channel : null,
    },
    channelCommissionLine: {
      findUnique: async (args: {
        where: {
          reservationId_channelId_serviceId?: {
            reservationId: string;
            channelId: string;
            serviceId: string;
          };
          paymentId?: string;
        };
      }) => {
        const compound = args.where.reservationId_channelId_serviceId;
        const line = compound
          ? reservation.commissionLines.find(
              (candidate) =>
                candidate.reservationId === compound.reservationId &&
                candidate.channelId === compound.channelId &&
                candidate.serviceId === compound.serviceId
            )
          : reservation.commissionLines.find((candidate) => candidate.paymentId === args.where.paymentId);
        return line ? { id: line.id, status: line.status, paymentId: line.paymentId } : null;
      },
      findMany: async (args: { where: { reservationId: string; status: string } }) =>
        reservation.commissionLines.filter(
          (line) => line.reservationId === args.where.reservationId && line.status === args.where.status
        ),
      update: async (args: { where: { id: string }; data: Partial<CommissionLineRow> }) => {
        const line = reservation.commissionLines.find((candidate) => candidate.id === args.where.id);
        if (!line) throw new Error("Commission line not found");
        Object.assign(line, args.data);
        return line;
      },
      create: async (args: { data: Partial<CommissionLineRow> }) => {
        const line = {
          id: `commission_${reservation.commissionLines.length + 1}`,
          channelId: String(args.data.channelId),
          reservationId: args.data.reservationId ?? null,
          paymentId: args.data.paymentId ?? null,
          serviceId: args.data.serviceId ?? null,
          status: "PENDING" as const,
          commissionCents: Number(args.data.commissionCents ?? 0),
          notes: null,
        };
        reservation.commissionLines.push(line);
        return line;
      },
    },
    payment: new Proxy(
      {
        create: async (args: { data: Partial<PaymentRow> }) => {
          paymentMutations.push("create");
          const payment: PaymentRow = {
            id: `pay_${reservation.payments.length + 1}`,
            amountCents: Number(args.data.amountCents ?? 0),
            isDeposit: Boolean(args.data.isDeposit),
            direction: args.data.direction === "OUT" ? "OUT" : "IN",
            origin: args.data.origin ?? null,
            method: args.data.method ?? null,
            customerName: args.data.customerName ?? null,
            createdByUserId: args.data.createdByUserId ?? null,
            shiftSessionId: args.data.shiftSessionId ?? null,
            description: args.data.description ?? null,
            notes: args.data.notes ?? null,
          };
          reservation.payments.push(payment);
          paymentCreates.push(payment);
          return payment;
        },
      },
      {
        get(target, property, receiver) {
          if (property in target) return Reflect.get(target, property, receiver);
          if (["update", "delete", "deleteMany", "updateMany", "createMany"].includes(String(property))) {
            return async () => {
              paymentMutations.push(String(property));
              throw new Error(`Unexpected payment mutation: ${String(property)}`);
            };
          }
          return undefined;
        },
      }
    ),
  };
  let transactionTail = Promise.resolve();

  return {
    reservation,
    paymentMutations,
    paymentCreates,
    client: {
      $transaction: async <T>(fn: (transactionClient: unknown) => Promise<T>) => {
        const previous = transactionTail;
        let release!: () => void;
        transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await fn(tx);
        } finally {
          release();
        }
      },
    },
  };
}

async function assertBlocked(
  promise: Promise<unknown>,
  expectedBlocker: string,
  expectedMessage?: string
) {
  await assert.rejects(
    promise,
    (error: unknown) => {
      assert.ok(error instanceof CommercialAdjustmentCommitBlockedError);
      assert.ok(error.blockers.includes(expectedBlocker as never));
      if (expectedMessage) assert.equal(error.message, expectedMessage);
      return true;
    }
  );
}

test("commit logico sin pagos actualiza total y sync contratos", async () => {
  const { client, reservation, paymentMutations } = makeState();

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 12_000,
    operationType: "EDIT",
    requestedRefundMode: "none",
    reason: "Ajuste comercial",
  });

  assert.equal(result?.newTotalCents, 12_000);
  assert.equal(reservation.totalPriceCents, 12_000);
  assert.equal(reservation.items[0]?.totalPriceCents, 12_000);
  assert.equal(result?.contracts.createdContracts, 1);
  assert.equal(reservation.contracts[0]?.status, "DRAFT");
  assert.deepEqual(paymentMutations, []);
});

test("commit ejecuta hooks transaccionales sin duplicar calculo", async () => {
  const { client } = makeState();
  const calls: string[] = [];

  await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 12_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
      reason: "Ajuste comercial",
    },
    {
      beforeMutationTx: async (_tx, context) => {
        calls.push("before");
        assert.equal(context.reservation.id, "res_1");
        assert.equal(context.evaluation.oldTotalCents, 10_000);
        assert.equal(context.evaluation.newTotalCents, 12_000);
      },
      afterMutationTx: async (_tx, context) => {
        calls.push("after");
        assert.equal(context.updated.id, "res_1");
        assert.equal(context.resultEvaluation.pendingServiceCents, 12_000);
      },
    }
  );

  assert.deepEqual(calls, ["before", "after"]);
});

test("pago parcial y nuevo total mayor deja pendiente de cobro", async () => {
  const { client, reservation } = makeState({
    status: "READY_FOR_PLATFORM",
    paymentCompletedAt: new Date("2026-07-01T10:00:00.000Z"),
    readyForPlatformAt: new Date("2026-07-01T10:00:00.000Z"),
    payments: [{ id: "pay_1", amountCents: 5_000, isDeposit: false, direction: "IN" }],
    units: [
      {
        id: "unit_1",
        status: "READY_FOR_PLATFORM",
        readyForPlatformAt: new Date("2026-07-01T10:00:00.000Z"),
        jetskiId: null,
      },
    ],
  });

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 15_000,
    operationType: "EDIT",
    requestedRefundMode: "none",
    refundScope: "DEPOSIT",
  });

  assert.equal(result?.pendingServiceCents, 10_000);
  assert.equal(reservation.status, "WAITING");
  assert.equal(reservation.paymentCompletedAt, null);
  assert.equal(reservation.readyForPlatformAt, null);
  assert.equal(reservation.units[0]?.status, "WAITING");
});

test("pago total y nuevo total menor con leavePendingRefund aplica y devuelve pendingRefund", async () => {
  const { client, reservation, paymentMutations } = makeState({
    payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
  });
  const beforePayments = JSON.stringify(reservation.payments);

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 8_000,
    operationType: "EDIT",
    requestedRefundMode: "leavePendingRefund",
    reason: "Pendiente de devolucion",
  });

  assert.equal(result?.pendingRefundCents, 2_000);
  assert.equal(result?.pendingServiceRefundCents, 2_000);
  assert.equal(result?.overpaidServiceCents, 2_000);
  assert.equal(reservation.totalPriceCents, 8_000);
  assert.equal(JSON.stringify(reservation.payments), beforePayments);
  assert.deepEqual(paymentMutations, []);
});

test("EDIT con sobrepago de servicio y refundScope DEPOSIT bloquea", async () => {
  const { client, reservation, paymentMutations } = makeState({
    payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
  });

  await assertBlocked(
    commitCommercialAdjustment(client as never, "res_1", {
      newTotalCents: 8_000,
      operationType: "EDIT",
      requestedRefundMode: "refundNow",
      refundScope: "DEPOSIT",
      reason: "Devolucion aprobada",
    }),
    "REFUND_SCOPE_INCOMPATIBLE",
    "El ajuste deja servicio sobrepagado y el alcance de devolucion debe incluir SERVICE."
  );

  assert.equal(reservation.totalPriceCents, 10_000);
  assert.deepEqual(paymentMutations, []);
});

test("refundNow crea Payment OUT auditable sin modificar el pago historico", async () => {
  const historicPayment = { id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" as const };
  const { client, reservation, paymentMutations, paymentCreates } = makeState({
    payments: [historicPayment],
  });
  const beforeHistoricPayment = { ...historicPayment };

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 8_000,
      operationType: "EDIT",
      requestedRefundMode: "refundNow",
      reason: "Devolver diferencia aprobada",
    },
    {
      actorUserId: "user_1",
      refundMethod: PaymentMethod.CASH,
      refundOrigin: PaymentOrigin.STORE,
      refundShiftSessionId: "shift_1",
      assertRefundCashOpen: async () => undefined,
    }
  );

  assert.equal(result?.refundNowCents, 2_000);
  assert.equal(result?.paidServiceCents, 8_000);
  assert.equal(result?.pendingServiceCents, 0);
  assert.equal(result?.overpaidServiceCents, 0);
  assert.deepEqual(reservation.payments[0], beforeHistoricPayment);
  assert.deepEqual(paymentMutations, ["create"]);
  assert.equal(paymentCreates.length, 1);
  assert.equal(paymentCreates[0]?.amountCents, 2_000);
  assert.equal(paymentCreates[0]?.direction, "OUT");
  assert.equal(paymentCreates[0]?.isDeposit, false);
  assert.equal(paymentCreates[0]?.createdByUserId, "user_1");
  assert.equal(paymentCreates[0]?.shiftSessionId, "shift_1");
  assert.equal(paymentCreates[0]?.description, "Devolucion por ajuste comercial");
  assert.match(paymentCreates[0]?.notes ?? "", /Devolver diferencia aprobada/);
});

test("EDIT con sobrepago de servicio permite refundNow con scope SERVICE y FULL", async () => {
  for (const refundScope of ["SERVICE", "FULL"] as const) {
    const { client, paymentCreates } = makeState({
      payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
    });

    const result = await commitCommercialAdjustment(
      client as never,
      "res_1",
      {
        newTotalCents: 8_000,
        operationType: "EDIT",
        requestedRefundMode: "refundNow",
        refundScope,
        reason: "Devolucion aprobada",
      },
      {
        assertRefundCashOpen: async () => undefined,
      }
    );

    assert.equal(result?.refundNowCents, 2_000);
    assert.equal(result?.serviceRefundNowCents, 2_000);
    assert.equal(paymentCreates.length, 1);
    assert.equal(paymentCreates[0]?.amountCents, 2_000);
    assert.equal(paymentCreates[0]?.isDeposit, false);
  }
});

test("refundNow bloquea si la caja esta cerrada", async () => {
  const { client, reservation, paymentMutations } = makeState({
    payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
  });

  await assert.rejects(
    commitCommercialAdjustment(
      client as never,
      "res_1",
      {
        newTotalCents: 8_000,
        operationType: "EDIT",
        requestedRefundMode: "refundNow",
        reason: "Devolver ahora",
      },
      {
        assertRefundCashOpen: async () => {
          throw new Error("Caja cerrada para este turno. Pide a ADMIN que la reabra.");
        },
      }
    ),
    /Caja cerrada/
  );

  assert.equal(reservation.totalPriceCents, 10_000);
  assert.deepEqual(paymentMutations, []);
});

test("doble peticion concurrente refundNow no duplica devoluciones", async () => {
  const { client, reservation, paymentCreates } = makeState({
    payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
  });

  const proposal = {
    newTotalCents: 8_000,
    operationType: "EDIT" as const,
    requestedRefundMode: "refundNow" as const,
    reason: "Devolver diferencia aprobada",
  };

  const [first, second] = await Promise.all([
    commitCommercialAdjustment(client as never, "res_1", proposal, {
      assertRefundCashOpen: async () => undefined,
    }),
    commitCommercialAdjustment(client as never, "res_1", proposal, {
      assertRefundCashOpen: async () => undefined,
    }),
  ]);

  assert.equal(paymentCreates.length, 1);
  assert.equal(paymentCreates[0]?.amountCents, 2_000);
  assert.equal(reservation.payments.filter((payment) => payment.direction === "OUT").length, 1);
  assert.deepEqual(
    [first?.refundNowCents, second?.refundNowCents].sort((left, right) => Number(left) - Number(right)),
    [0, 2_000]
  );
});

test("contrato SIGNED con EDIT bloquea", async () => {
  const { client } = makeState({
    contracts: [baseContract("signed_1", "SIGNED", 1)],
  });

  await assertBlocked(
    commitCommercialAdjustment(client as never, "res_1", {
      newTotalCents: 9_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
    }),
    "SIGNED_CONTRACT_MATERIAL_EDIT"
  );
});

test("contrato SIGNED con CANCEL permite cancelar y conserva firmado", async () => {
  const { client, reservation } = makeState({
    contracts: [
      baseContract("signed_1", "SIGNED", 1),
      baseContract("draft_2", "DRAFT", 2),
    ],
  });

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 0,
    operationType: "CANCEL",
    requestedRefundMode: "none",
    reason: "Cancelacion comercial",
  });

  assert.equal(result?.status, "CANCELED");
  assert.equal(reservation.status, "CANCELED");
  assert.equal(reservation.contracts.find((contract) => contract.id === "signed_1")?.status, "SIGNED");
  assert.equal(reservation.contracts.find((contract) => contract.id === "draft_2")?.status, "VOID");
});

test("cancelacion con refundNow crea OUT y conserva contratos SIGNED", async () => {
  const { client, reservation, paymentCreates } = makeState({
    payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
    contracts: [
      baseContract("signed_1", "SIGNED", 1),
      baseContract("draft_2", "DRAFT", 2),
    ],
  });

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      reason: "Cancelacion con devolucion",
    },
    {
      actorUserId: "user_1",
      refundMethod: PaymentMethod.CASH,
      refundOrigin: PaymentOrigin.STORE,
      assertRefundCashOpen: async () => undefined,
    }
  );

  assert.equal(result?.status, "CANCELED");
  assert.equal(result?.refundNowCents, 10_000);
  assert.equal(result?.serviceRefundNowCents, 10_000);
  assert.equal(result?.depositRefundNowCents, 0);
  assert.equal(result?.paidServiceCents, 0);
  assert.equal(result?.overpaidServiceCents, 0);
  assert.equal(paymentCreates.length, 1);
  assert.equal(paymentCreates[0]?.amountCents, 10_000);
  assert.equal(paymentCreates[0]?.direction, "OUT");
  assert.equal(paymentCreates[0]?.description, "Devolucion por cancelacion comercial");
  assert.equal(reservation.contracts.find((contract) => contract.id === "signed_1")?.status, "SIGNED");
  assert.equal(reservation.contracts.find((contract) => contract.id === "draft_2")?.status, "VOID");
});

test("cancelacion pagada con servicio y fianza crea dos OUT separados", async () => {
  const servicePayment = { id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" as const };
  const depositPayment = { id: "pay_2", amountCents: 5_000, isDeposit: true, direction: "IN" as const };
  const { client, reservation, paymentCreates } = makeState({
    depositCents: 5_000,
    payments: [servicePayment, depositPayment],
  });
  const beforeServicePayment = { ...servicePayment };
  const beforeDepositPayment = { ...depositPayment };

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      refundScope: "FULL",
      reason: "Cancelacion con devolucion completa",
    },
    {
      actorUserId: "user_1",
      refundMethod: PaymentMethod.CASH,
      refundOrigin: PaymentOrigin.STORE,
      assertRefundCashOpen: async () => undefined,
    }
  );

  assert.equal(result?.refundNowCents, 15_000);
  assert.equal(result?.serviceRefundNowCents, 10_000);
  assert.equal(result?.depositRefundNowCents, 5_000);
  assert.equal(result?.paidServiceCents, 0);
  assert.equal(result?.paidDepositCents, 0);
  assert.deepEqual(reservation.payments[0], beforeServicePayment);
  assert.deepEqual(reservation.payments[1], beforeDepositPayment);
  assert.equal(paymentCreates.length, 2);
  assert.deepEqual(
    paymentCreates.map((payment) => ({
      amountCents: payment.amountCents,
      isDeposit: payment.isDeposit,
      direction: payment.direction,
    })),
    [
      { amountCents: 10_000, isDeposit: false, direction: "OUT" },
      { amountCents: 5_000, isDeposit: true, direction: "OUT" },
    ]
  );

  const paymentStatus = resolveReservationPaymentStatus({
    reservationStatus: reservation.status,
    totalPriceCents: reservation.totalPriceCents,
    depositCents: reservation.depositCents,
    quantity: reservation.quantity,
    isLicense: reservation.isLicense,
    serviceCategory: reservation.service.category,
    items: reservation.items,
    payments: reservation.payments,
  });

  assert.equal(paymentStatus.paidServiceCents, 0);
  assert.equal(paymentStatus.paidDepositCents, 0);
  assert.equal(paymentStatus.overpaidServiceCents, 0);
  assert.equal(paymentStatus.overpaidDepositCents, 0);
});

test("cancelacion legacy SERVICE con servicio y fianza pagados crea OUT solo de servicio", async () => {
  const servicePayment = { id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" as const };
  const depositPayment = { id: "pay_2", amountCents: 5_000, isDeposit: true, direction: "IN" as const };
  const { client, reservation, paymentCreates } = makeState({
    depositCents: 5_000,
    payments: [servicePayment, depositPayment],
  });
  const beforeServicePayment = { ...servicePayment };
  const beforeDepositPayment = { ...depositPayment };

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      refundScope: "SERVICE",
      reason: "Cancelacion con devolucion de servicio",
    },
    {
      assertRefundCashOpen: async () => undefined,
    }
  );

  assert.equal(result?.refundNowCents, 10_000);
  assert.equal(result?.serviceRefundNowCents, 10_000);
  assert.equal(result?.depositRefundNowCents, 0);
  assert.deepEqual(reservation.payments[0], beforeServicePayment);
  assert.deepEqual(reservation.payments[1], beforeDepositPayment);
  assert.equal(paymentCreates.length, 1);
  assert.deepEqual(
    paymentCreates.map((payment) => ({
      amountCents: payment.amountCents,
      isDeposit: payment.isDeposit,
      direction: payment.direction,
    })),
    [{ amountCents: 10_000, isDeposit: false, direction: "OUT" }]
  );
});

test("cancelacion con alcance DEPOSIT crea OUT solo de fianza", async () => {
  const servicePayment = { id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" as const };
  const depositPayment = { id: "pay_2", amountCents: 5_000, isDeposit: true, direction: "IN" as const };
  const { client, reservation, paymentCreates } = makeState({
    depositCents: 5_000,
    payments: [servicePayment, depositPayment],
  });
  const beforeServicePayment = { ...servicePayment };
  const beforeDepositPayment = { ...depositPayment };

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      refundScope: "DEPOSIT",
      reason: "Cancelacion con devolucion de fianza",
    },
    {
      assertRefundCashOpen: async () => undefined,
    }
  );

  assert.equal(result?.refundNowCents, 5_000);
  assert.equal(result?.serviceRefundNowCents, 0);
  assert.equal(result?.depositRefundNowCents, 5_000);
  assert.deepEqual(reservation.payments[0], beforeServicePayment);
  assert.deepEqual(reservation.payments[1], beforeDepositPayment);
  assert.equal(paymentCreates.length, 1);
  assert.deepEqual(
    paymentCreates.map((payment) => ({
      amountCents: payment.amountCents,
      isDeposit: payment.isDeposit,
      direction: payment.direction,
    })),
    [{ amountCents: 5_000, isDeposit: true, direction: "OUT" }]
  );
});

test("cancelacion legacy NONE con servicio y fianza pagados deja devolucion pendiente y no crea OUT", async () => {
  const servicePayment = { id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" as const };
  const depositPayment = { id: "pay_2", amountCents: 5_000, isDeposit: true, direction: "IN" as const };
  const { client, reservation, paymentMutations } = makeState({
    depositCents: 5_000,
    payments: [servicePayment, depositPayment],
  });
  const beforeServicePayment = { ...servicePayment };
  const beforeDepositPayment = { ...depositPayment };
  const refundSelection = refundSelectionForStoreCancel({ refundMode: "NONE" });

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 0,
    newDepositCents: 0,
    operationType: "CANCEL",
    ...refundSelection,
    reason: "Cancelacion sin devolucion inmediata",
  });

  assert.equal(result?.status, "CANCELED");
  assert.equal(result?.refundNowCents, 0);
  assert.equal(result?.pendingRefundCents, 15_000);
  assert.equal(result?.pendingServiceRefundCents, 10_000);
  assert.equal(result?.pendingDepositRefundCents, 5_000);
  assert.deepEqual(reservation.payments[0], beforeServicePayment);
  assert.deepEqual(reservation.payments[1], beforeDepositPayment);
  assert.deepEqual(paymentMutations, []);
});

test("cancelacion legacy NONE sin importes pagados cancela sin devolucion", async () => {
  const { client, paymentMutations } = makeState();
  const refundSelection = refundSelectionForStoreCancel({ refundMode: "NONE" });

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 0,
    newDepositCents: 0,
    operationType: "CANCEL",
    ...refundSelection,
    reason: "Cancelacion sin pagos",
  });

  assert.equal(result?.status, "CANCELED");
  assert.equal(result?.refundNowCents, 0);
  assert.equal(result?.pendingRefundCents, 0);
  assert.equal(result?.pendingServiceRefundCents, 0);
  assert.equal(result?.pendingDepositRefundCents, 0);
  assert.deepEqual(paymentMutations, []);
});

test("cancelacion pagada solo con fianza crea un OUT de fianza", async () => {
  const { client, paymentCreates } = makeState({
    depositCents: 5_000,
    payments: [{ id: "pay_1", amountCents: 5_000, isDeposit: true, direction: "IN" }],
  });

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      refundScope: "DEPOSIT",
      reason: "Cancelacion con devolucion de fianza",
    },
    {
      assertRefundCashOpen: async () => undefined,
    }
  );

  assert.equal(result?.refundNowCents, 5_000);
  assert.equal(result?.serviceRefundNowCents, 0);
  assert.equal(result?.depositRefundNowCents, 5_000);
  assert.equal(paymentCreates.length, 1);
  assert.equal(paymentCreates[0]?.amountCents, 5_000);
  assert.equal(paymentCreates[0]?.isDeposit, true);
  assert.equal(paymentCreates[0]?.direction, "OUT");
});

test("cancelacion con fianza retenida no devuelve la fianza", async () => {
  const { client, paymentCreates } = makeState({
    depositCents: 5_000,
    depositHeld: true,
    depositHoldReason: "Dano pendiente de revisar",
    payments: [{ id: "pay_1", amountCents: 5_000, isDeposit: true, direction: "IN" }],
  });

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "refundNow",
      reason: "Cancelacion con fianza retenida",
    },
    {
      assertRefundCashOpen: async () => undefined,
    }
  );

  assert.equal(result?.refundNowCents, 0);
  assert.equal(result?.depositRefundNowCents, 0);
  assert.equal(result?.depositRefundHeldCents, 5_000);
  assert.equal(result?.depositRefundBlockedReason, "DEPOSIT_HELD");
  assert.ok(result?.warnings.includes("DEPOSIT_HELD_NOT_REFUNDED"));
  assert.deepEqual(paymentCreates, []);
});

test("cancelacion con refundNow bloquea si la caja esta cerrada", async () => {
  const { client, reservation, paymentMutations } = makeState({
    payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
    contracts: [baseContract("signed_1", "SIGNED", 1)],
  });

  await assert.rejects(
    commitCommercialAdjustment(
      client as never,
      "res_1",
      {
        newTotalCents: 0,
        newDepositCents: 0,
        operationType: "CANCEL",
        requestedRefundMode: "refundNow",
        reason: "Cancelacion con devolucion",
      },
      {
        assertRefundCashOpen: async () => {
          throw new Error("Caja cerrada para este turno. Pide a ADMIN que la reabra.");
        },
      }
    ),
    /Caja cerrada/
  );

  assert.equal(reservation.status, "WAITING");
  assert.deepEqual(paymentMutations, []);
  assert.equal(reservation.contracts.find((contract) => contract.id === "signed_1")?.status, "SIGNED");
});

test("cancelacion con leavePendingRefund de servicio y fianza no crea OUT", async () => {
  const { client, paymentMutations } = makeState({
    depositCents: 5_000,
    payments: [
      { id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" },
      { id: "pay_2", amountCents: 5_000, isDeposit: true, direction: "IN" },
    ],
  });

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 0,
    newDepositCents: 0,
    operationType: "CANCEL",
    requestedRefundMode: "leavePendingRefund",
    reason: "Cancelacion con devolucion pendiente",
  });

  assert.equal(result?.pendingRefundCents, 15_000);
  assert.equal(result?.pendingServiceRefundCents, 10_000);
  assert.equal(result?.pendingDepositRefundCents, 5_000);
  assert.deepEqual(paymentMutations, []);
});

test("cancelacion con leavePendingRefund solo de fianza no crea OUT y cancela", async () => {
  const { client, paymentMutations } = makeState({
    depositCents: 5_000,
    payments: [{ id: "pay_1", amountCents: 5_000, isDeposit: true, direction: "IN" }],
  });

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 0,
    newDepositCents: 0,
    operationType: "CANCEL",
    requestedRefundMode: "leavePendingRefund",
    refundScope: "DEPOSIT",
    reason: "Cancelacion con fianza pendiente",
  });

  assert.equal(result?.status, "CANCELED");
  assert.equal(result?.refundNowCents, 0);
  assert.equal(result?.pendingRefundCents, 5_000);
  assert.equal(result?.pendingServiceRefundCents, 0);
  assert.equal(result?.pendingDepositRefundCents, 5_000);
  assert.deepEqual(paymentMutations, []);
});

test("cancelacion con leavePendingRefund no crea OUT", async () => {
  const { client, reservation, paymentMutations } = makeState({
    payments: [{ id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" }],
    contracts: [baseContract("signed_1", "SIGNED", 1)],
  });

  const result = await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 0,
    newDepositCents: 0,
    operationType: "CANCEL",
    requestedRefundMode: "leavePendingRefund",
    reason: "Cancelacion con devolucion pendiente",
  });

  assert.equal(result?.status, "CANCELED");
  assert.equal(result?.pendingRefundCents, 10_000);
  assert.equal(result?.overpaidServiceCents, 10_000);
  assert.deepEqual(paymentMutations, []);
  assert.equal(reservation.contracts.find((contract) => contract.id === "signed_1")?.status, "SIGNED");
});

test("cancelacion concurrente con servicio y fianza no duplica devoluciones", async () => {
  const { client, reservation, paymentCreates } = makeState({
    depositCents: 5_000,
    payments: [
      { id: "pay_1", amountCents: 10_000, isDeposit: false, direction: "IN" },
      { id: "pay_2", amountCents: 5_000, isDeposit: true, direction: "IN" },
    ],
  });

  const proposal = {
    newTotalCents: 0,
    newDepositCents: 0,
    operationType: "CANCEL" as const,
    requestedRefundMode: "refundNow" as const,
    reason: "Cancelacion con devolucion completa",
  };

  const attempts = await Promise.allSettled([
    commitCommercialAdjustment(client as never, "res_1", proposal, {
      assertRefundCashOpen: async () => undefined,
    }),
    commitCommercialAdjustment(client as never, "res_1", proposal, {
      assertRefundCashOpen: async () => undefined,
    }),
  ]);

  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(paymentCreates.length, 2);
  assert.equal(paymentCreates.filter((payment) => !payment.isDeposit && payment.direction === "OUT").length, 1);
  assert.equal(paymentCreates.filter((payment) => payment.isDeposit && payment.direction === "OUT").length, 1);
  assert.equal(reservation.payments.filter((payment) => payment.direction === "OUT").length, 2);
});

test("cancelacion con SIGNED ejecuta hooks transaccionales para checks y logging", async () => {
  const { client } = makeState({
    contracts: [baseContract("signed_1", "SIGNED", 1)],
  });
  const calls: string[] = [];

  const result = await commitCommercialAdjustment(
    client as never,
    "res_1",
    {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "none",
      reason: "Cancelacion operativa revisada",
    },
    {
      beforeMutationTx: async (_tx, context) => {
        calls.push("before-operational-check");
        assert.equal(context.proposal.operationType, "CANCEL");
        assert.equal(context.reservation.status, "WAITING");
      },
      afterMutationTx: async (_tx, context) => {
        calls.push("after-operational-log");
        assert.equal(context.updated.status, "CANCELED");
        assert.equal(context.resultEvaluation.refundNowCents, 0);
        assert.ok(context.resultEvaluation.warnings.includes("SIGNED_CONTRACT_HISTORY_PRESERVED"));
      },
    }
  );

  assert.equal(result?.status, "CANCELED");
  assert.deepEqual(calls, ["before-operational-check", "after-operational-log"]);
});

test("comision PAID bloquea", async () => {
  const { client } = makeState({
    commissionLines: [
      {
        id: "comm_1",
        channelId: "ch_1",
        reservationId: "res_1",
        paymentId: null,
        serviceId: "svc_1",
        status: "PAID",
        commissionCents: 1_000,
        notes: null,
      },
    ],
  });

  await assertBlocked(
    commitCommercialAdjustment(client as never, "res_1", {
      newTotalCents: 12_000,
      operationType: "EDIT",
      requestedRefundMode: "none",
    }),
    "PAID_COMMISSION"
  );
});

test("comision PAID bloquea CANCEL", async () => {
  const { client } = makeState({
    commissionLines: [
      {
        id: "comm_1",
        channelId: "ch_1",
        reservationId: "res_1",
        paymentId: null,
        serviceId: "svc_1",
        status: "PAID",
        commissionCents: 1_000,
        notes: null,
      },
    ],
  });

  await assertBlocked(
    commitCommercialAdjustment(client as never, "res_1", {
      newTotalCents: 0,
      newDepositCents: 0,
      operationType: "CANCEL",
      requestedRefundMode: "none",
      reason: "Cancelacion comercial",
    }),
    "PAID_COMMISSION"
  );
});

test("voucher pass o gift bloquea fase 1", async () => {
  for (const blockedField of ["giftVoucherId", "passVoucherId", "passConsumeId"]) {
    const { client } = makeState({ [blockedField]: "blocked_1" });

    await assertBlocked(
      commitCommercialAdjustment(client as never, "res_1", {
        newTotalCents: 12_000,
        operationType: "EDIT",
        requestedRefundMode: "none",
      }),
      "VOUCHER_OR_PASS_OR_GIFT"
    );
  }
});

test("comision PENDING se recalcula sin crear pagos", async () => {
  const { client, reservation, paymentMutations } = makeState({
    channelId: "ch_1",
    commissionLines: [
      {
        id: "comm_1",
        channelId: "ch_1",
        reservationId: "res_1",
        paymentId: null,
        serviceId: "svc_1",
        status: "PENDING",
        commissionCents: 1_000,
        notes: null,
      },
    ],
  });

  await commitCommercialAdjustment(client as never, "res_1", {
    newTotalCents: 12_000,
    operationType: "EDIT",
    requestedRefundMode: "none",
  });

  assert.equal(reservation.appliedCommissionCents, 1_200);
  assert.equal(reservation.commissionLines[0]?.commissionCents, 1_200);
  assert.deepEqual(paymentMutations, []);
});
