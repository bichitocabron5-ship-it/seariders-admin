import assert from "node:assert/strict";
import test from "node:test";

import {
  countReadyVisibleContractsByTargets,
  pickVisibleContractsByTargets,
} from "./contracts/active-contracts";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "./reservation-contract-requirements";
import { getReservationWorkflowState } from "./reservation-workflow";

type ContractStatus = "DRAFT" | "READY" | "SIGNED" | "VOID";

function mainItem(args: {
  id?: string | null;
  category: string;
  serviceId: string;
  optionId: string;
  quantity?: number;
}) {
  return {
    id: args.id,
    serviceId: args.serviceId,
    optionId: args.optionId,
    quantity: args.quantity ?? 1,
    pax: 1,
    totalPriceCents: 10000,
    isExtra: false,
    service: {
      name: args.serviceId,
      category: args.category,
    },
    option: {
      durationMinutes: 20,
    },
  };
}

function contract(
  status: ContractStatus,
  logicalUnitIndex: number,
  reservationItemId: string | null,
  patch: { id?: string; supersededAt?: Date | null } = {}
) {
  return {
    id: patch.id ?? `${reservationItemId ?? "legacy"}-${logicalUnitIndex}-${status}`,
    unitIndex: logicalUnitIndex,
    logicalUnitIndex,
    reservationItemId,
    status,
    supersededAt: patch.supersededAt ?? null,
    createdAt: new Date(`2026-07-29T10:0${logicalUnitIndex}:00.000Z`),
  };
}

function targetsForItems(items: ReturnType<typeof mainItem>[]) {
  return reservationContractRequirementsToSyncTargets(
    buildReservationContractRequirements({
      quantity: items.length,
      isLicense: false,
      serviceCategory: "PACK",
      items,
    })
  );
}

test("prefill propaga ReservationItem.id hasta targets y cuenta contrato READY moderno", () => {
  const targets = targetsForItems([
    mainItem({
      id: "banana-line",
      category: "NAUTICA",
      serviceId: "service-banana",
      optionId: "option-banana",
    }),
    mainItem({
      id: "jetski-line",
      category: "JETSKI",
      serviceId: "service-jetski",
      optionId: "option-jetski",
    }),
  ]);

  assert.deepEqual(
    targets.map((target) => ({
      reservationItemId: target.reservationItemId,
      logicalUnitIndex: target.logicalUnitIndex,
    })),
    [{ reservationItemId: "jetski-line", logicalUnitIndex: 1 }]
  );
  assert.equal(
    countReadyVisibleContractsByTargets(
      [contract("READY", 1, "jetski-line")],
      targets
    ),
    1
  );
});

test("contrato SIGNED vinculado a item cuenta y pack firmado permite formalizar", () => {
  const targets = targetsForItems([
    mainItem({
      id: "banana-line",
      category: "NAUTICA",
      serviceId: "service-banana",
      optionId: "option-banana",
    }),
    mainItem({
      id: "jetski-line",
      category: "JETSKI",
      serviceId: "service-jetski",
      optionId: "option-jetski",
    }),
  ]);
  const contracts = [contract("SIGNED", 1, "jetski-line")];
  const visibleContracts = pickVisibleContractsByTargets(contracts, targets);
  const readyCount = countReadyVisibleContractsByTargets(contracts, targets);
  const signedCount = visibleContracts.filter((item) => item.status === "SIGNED").length;
  const workflow = getReservationWorkflowState({
    reservationId: "reservation-pack",
    status: "WAITING",
    formalizedAt: null,
    customerName: "Laura",
    customerPhone: "600000000",
    requiredUnits: targets.length,
    readyCount,
    signedCount,
    pendingServiceCents: 0,
    pendingDepositCents: 0,
  });

  assert.equal(readyCount, 1);
  assert.equal(signedCount, 1);
  assert.equal(workflow.visibleState, "signed_pending_formalization");
  assert.equal(workflow.primaryAction.label, "Formalizar reserva");
});

test("dos lineas distintas no mezclan contratos vinculados por reservationItemId", () => {
  const targets = targetsForItems([
    mainItem({
      id: "jetski-20-line",
      category: "JETSKI",
      serviceId: "service-jetski-20",
      optionId: "option-jetski-20",
    }),
    mainItem({
      id: "jetski-40-line",
      category: "JETSKI",
      serviceId: "service-jetski-40",
      optionId: "option-jetski-40",
    }),
  ]);
  const contracts = [
    contract("READY", 1, "jetski-20-line", { id: "right-line" }),
    contract("READY", 2, "jetski-20-line", { id: "wrong-line" }),
  ];

  assert.deepEqual(
    pickVisibleContractsByTargets(contracts, targets).map((item) => item.id),
    ["right-line"]
  );
  assert.equal(countReadyVisibleContractsByTargets(contracts, targets), 1);
});

test("Banana sin contrato no afecta al target Jetski", () => {
  const targets = targetsForItems([
    mainItem({
      id: "banana-line",
      category: "NAUTICA",
      serviceId: "service-banana",
      optionId: "option-banana",
    }),
    mainItem({
      id: "jetski-line",
      category: "JETSKI",
      serviceId: "service-jetski",
      optionId: "option-jetski",
    }),
  ]);

  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.reservationItemId, "jetski-line");
  assert.equal(
    countReadyVisibleContractsByTargets(
      [contract("READY", 1, "jetski-line")],
      targets
    ),
    1
  );
});

test("contrato legacy sin reservationItemId sigue usando fallback seguro por slot unico", () => {
  const targets = targetsForItems([
    mainItem({
      id: "banana-line",
      category: "NAUTICA",
      serviceId: "service-banana",
      optionId: "option-banana",
    }),
    mainItem({
      id: "jetski-line",
      category: "JETSKI",
      serviceId: "service-jetski",
      optionId: "option-jetski",
    }),
  ]);

  assert.deepEqual(
    pickVisibleContractsByTargets(
      [contract("READY", 1, null, { id: "legacy-contract" })],
      targets
    ).map((item) => item.id),
    ["legacy-contract"]
  );
});

test("contratos VOID o superseded no cuentan en prefill", () => {
  const targets = targetsForItems([
    mainItem({
      id: "jetski-line",
      category: "JETSKI",
      serviceId: "service-jetski",
      optionId: "option-jetski",
    }),
  ]);
  const contracts = [
    contract("VOID", 1, "jetski-line", { id: "void-contract" }),
    contract("READY", 1, "jetski-line", {
      id: "superseded-contract",
      supersededAt: new Date("2026-07-29T11:00:00.000Z"),
    }),
  ];
  const visibleContracts = pickVisibleContractsByTargets(contracts, targets);

  assert.deepEqual(visibleContracts, []);
  assert.equal(countReadyVisibleContractsByTargets(contracts, targets), 0);
  assert.equal(visibleContracts.filter((item) => item.status === "SIGNED").length, 0);
});

test("target sin ReservationItem.id no adopta contrato moderno de otra linea", () => {
  const targets = targetsForItems([
    mainItem({
      id: null,
      category: "JETSKI",
      serviceId: "service-jetski",
      optionId: "option-jetski",
    }),
  ]);

  assert.equal(targets[0]?.reservationItemId, null);
  assert.equal(
    countReadyVisibleContractsByTargets(
      [contract("READY", 1, "jetski-line")],
      targets
    ),
    0
  );
});
