import assert from "node:assert/strict";
import test from "node:test";

import {
  planReservationContractSync,
  type ReservationContractSyncInputContract,
  type ReservationContractSyncStatus,
} from "./reservation-contract-sync-plan";

function contract(
  id: string,
  status: ReservationContractSyncStatus,
  logicalUnitIndex: number,
  patch: Partial<ReservationContractSyncInputContract> = {}
): ReservationContractSyncInputContract {
  return {
    id,
    unitIndex: logicalUnitIndex,
    logicalUnitIndex,
    status,
    supersededAt: null,
    createdAt: new Date(`2026-06-30T10:0${logicalUnitIndex}:00.000Z`),
    templateCode: "JETSKI_LICENSED",
    requiresLicense: true,
    ...patch,
  };
}

const licensedJetskiPlan = {
  templateCode: "JETSKI_LICENSED",
  requiresLicense: true,
  expectedResourceKind: "jetski" as const,
};

test("de 1 a 2 unidades sin firmados conserva 1 contrato y crea 1 slot", () => {
  const plan = planReservationContractSync({
    requiredUnits: 2,
    contracts: [contract("contract-1", "DRAFT", 1)],
    ...licensedJetskiPlan,
  });

  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["contract-1"]
  );
  assert.deepEqual(
    plan.create.map((item) => item.logicalUnitIndex),
    [2]
  );
  assert.deepEqual(plan.void, []);
  assert.deepEqual(plan.blockers, []);
});

test("de 2 a 1 unidades sin firmados conserva 1 contrato y void 1 sobrante", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("contract-1", "DRAFT", 1),
      contract("contract-2", "READY", 2),
    ],
    ...licensedJetskiPlan,
  });

  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["contract-1"]
  );
  assert.deepEqual(
    plan.void.map((item) => item.contractId),
    ["contract-2"]
  );
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.blockers, []);
});

test("JETSKI a actividad sin contrato deja requiredUnits 0 y void todos los no firmados", () => {
  const plan = planReservationContractSync({
    requiredUnits: 0,
    contracts: [
      contract("contract-1", "DRAFT", 1, { templateCode: "JETSKI_NO_LICENSE", requiresLicense: false }),
      contract("contract-2", "READY", 2, { templateCode: "JETSKI_NO_LICENSE", requiresLicense: false }),
    ],
    templateCode: null,
    requiresLicense: false,
    expectedResourceKind: null,
  });

  assert.equal(plan.requiredUnits, 0);
  assert.deepEqual(plan.keep, []);
  assert.deepEqual(plan.create, []);
  assert.deepEqual(
    plan.void.map((item) => item.contractId),
    ["contract-1", "contract-2"]
  );
  assert.deepEqual(plan.blockers, []);
});

test("de 2 a 1 con 1 SIGNED y 1 READY conserva SIGNED y void READY", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("signed-1", "SIGNED", 1),
      contract("ready-2", "READY", 2),
    ],
    ...licensedJetskiPlan,
  });

  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["signed-1"]
  );
  assert.deepEqual(
    plan.void.map((item) => item.contractId),
    ["ready-2"]
  );
  assert.deepEqual(plan.blockers, []);
});

test("de 2 a 1 con 2 SIGNED devuelve blocker 409", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("signed-1", "SIGNED", 1),
      contract("signed-2", "SIGNED", 2),
    ],
    ...licensedJetskiPlan,
  });

  assert.equal(plan.blockers.length, 2);
  assert.equal(plan.blockers[0]?.status, 409);
  assert.equal(plan.blockers[0]?.code, "SIGNED_CONTRACT_REDUCTION");
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.void, []);
  assert.deepEqual(plan.reset, []);
});

test("READY no cuenta como bloqueante", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [contract("ready-1", "READY", 1)],
    materialChange: true,
    ...licensedJetskiPlan,
  });

  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["ready-1"]
  );
  assert.equal(plan.reset[0]?.contractId, "ready-1");
  assert.equal(plan.reset[0]?.nextStatus, "DRAFT");
});

test("READY JETSKI_LICENSED con expectedResourceKind null conserva preparedJetski", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("jetski-ready", "READY", 1, {
        templateCode: "JETSKI_LICENSED",
        expectedResourceKind: null,
        preparedJetskiId: "jetski-a",
      }),
    ],
    templateCode: "JETSKI_LICENSED",
    requiresLicense: true,
    expectedResourceKind: null,
  });

  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["jetski-ready"]
  );
  assert.deepEqual(plan.void, []);
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.reset, []);
});

test("READY BOAT_LICENSED con expectedResourceKind null conserva preparedAsset", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("boat-ready", "READY", 1, {
        templateCode: "BOAT_LICENSED",
        expectedResourceKind: null,
        preparedAssetId: "asset-boat",
        preparedAssetType: "BOAT",
      }),
    ],
    templateCode: "BOAT_LICENSED",
    requiresLicense: true,
    expectedResourceKind: null,
    expectedAssetType: "BOAT",
  });

  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["boat-ready"]
  );
  assert.deepEqual(plan.void, []);
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.reset, []);
});

test("expectedResourceKind explicito asset limpia preparedJetski", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("legacy-ready", "READY", 1, {
        templateCode: null,
        preparedJetskiId: "jetski-a",
      }),
    ],
    templateCode: null,
    requiresLicense: true,
    expectedResourceKind: "asset",
  });

  assert.equal(plan.reset[0]?.contractId, "legacy-ready");
  assert.equal(plan.reset[0]?.clearPreparedJetski, true);
  assert.equal(plan.reset[0]?.clearPreparedAsset, false);
  assert.equal(plan.reset[0]?.nextStatus, "DRAFT");
});

test("expectedResourceKind explicito jetski limpia preparedAsset", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("legacy-ready", "READY", 1, {
        templateCode: null,
        preparedAssetId: "asset-boat",
        preparedAssetType: "BOAT",
      }),
    ],
    templateCode: null,
    requiresLicense: true,
    expectedResourceKind: "jetski",
  });

  assert.equal(plan.reset[0]?.contractId, "legacy-ready");
  assert.equal(plan.reset[0]?.clearPreparedJetski, false);
  assert.equal(plan.reset[0]?.clearPreparedAsset, true);
  assert.equal(plan.reset[0]?.nextStatus, "DRAFT");
});

test("contrato READY compatible no baja a DRAFT por target null", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("ready-compatible", "READY", 1, {
        templateCode: null,
        requiresLicense: true,
        preparedJetskiId: "jetski-a",
      }),
    ],
    templateCode: null,
    requiresLicense: true,
    expectedResourceKind: null,
  });

  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["ready-compatible"]
  );
  assert.deepEqual(plan.void, []);
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.reset, []);
});

test("VOID y superseded no cuentan como activos", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("void-1", "VOID", 1),
      contract("superseded-1", "READY", 1, { supersededAt: new Date("2026-06-30T11:00:00.000Z") }),
    ],
    ...licensedJetskiPlan,
  });

  assert.deepEqual(plan.keep, []);
  assert.deepEqual(plan.void, []);
  assert.deepEqual(
    plan.create.map((item) => item.logicalUnitIndex),
    [1]
  );
  assert.deepEqual(plan.blockers, []);
});

test("cambio JETSKI_LICENSED a BOAT_LICENSED sin firmados invalida y limpia preparedJetski", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("jetski-1", "READY", 1, {
        templateCode: "JETSKI_LICENSED",
        preparedJetskiId: "jetski-a",
        renderedHtml: "<html>old</html>",
      }),
    ],
    templateCode: "BOAT_LICENSED",
    requiresLicense: true,
    expectedResourceKind: "asset",
    expectedAssetType: "BOAT",
  });

  assert.deepEqual(
    plan.void.map((item) => item.contractId),
    ["jetski-1"]
  );
  assert.deepEqual(
    plan.create.map((item) => item.logicalUnitIndex),
    [1]
  );
  assert.equal(plan.reset[0]?.contractId, "jetski-1");
  assert.equal(plan.reset[0]?.clearPreparedJetski, true);
  assert.equal(plan.reset[0]?.clearRender, true);
});

test("cambio BOAT_LICENSED a JETSKI_LICENSED sin firmados limpia preparedAsset", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("boat-1", "DRAFT", 1, {
        templateCode: "BOAT_LICENSED",
        expectedResourceKind: "asset",
        preparedAssetId: "asset-boat",
        preparedAssetType: "BOAT",
      }),
    ],
    templateCode: "JETSKI_LICENSED",
    requiresLicense: true,
    expectedResourceKind: "jetski",
  });

  assert.deepEqual(
    plan.void.map((item) => item.contractId),
    ["boat-1"]
  );
  assert.equal(plan.reset[0]?.contractId, "boat-1");
  assert.equal(plan.reset[0]?.clearPreparedAsset, true);
});

test("cambio material con READY limpia render y vuelve a estado editable", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [
      contract("ready-1", "READY", 1, {
        renderedHtml: "<html>old</html>",
        renderedPdfKey: "old.pdf",
        renderedPdfUrl: "https://example.test/old.pdf",
      }),
    ],
    materialChange: true,
    ...licensedJetskiPlan,
  });

  assert.deepEqual(
    plan.keep.map((item) => item.contractId),
    ["ready-1"]
  );
  assert.equal(plan.reset[0]?.contractId, "ready-1");
  assert.equal(plan.reset[0]?.clearRender, true);
  assert.equal(plan.reset[0]?.nextStatus, "DRAFT");
});

test("SIGNED incompatible devuelve blocker", () => {
  const plan = planReservationContractSync({
    requiredUnits: 1,
    contracts: [contract("signed-1", "SIGNED", 1, { templateCode: "JETSKI_LICENSED" })],
    templateCode: "BOAT_LICENSED",
    requiresLicense: true,
    expectedResourceKind: "asset",
  });

  assert.equal(plan.blockers.length, 2);
  assert.deepEqual(
    plan.blockers.map((item) => item.code),
    ["SIGNED_CONTRACT_TEMPLATE_INCOMPATIBLE", "SIGNED_CONTRACT_RESOURCE_INCOMPATIBLE"]
  );
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.void, []);
});
