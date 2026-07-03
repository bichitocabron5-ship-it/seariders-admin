import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import {
  ReservationContractSyncBlockedError,
  syncReservationContractsTx,
} from "./reservation-contract-sync";

type Row = {
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

function row(
  id: string,
  status: Row["status"],
  logicalUnitIndex: number,
  patch: Partial<Row> = {}
): Row {
  return {
    id,
    reservationId: "reservation-1",
    unitIndex: logicalUnitIndex,
    logicalUnitIndex,
    status,
    supersededAt: null,
    createdAt: new Date(`2026-06-30T10:0${logicalUnitIndex}:00.000Z`),
    templateCode: "JETSKI_LICENSED",
    templateVersion: "v1",
    renderedHtml: null,
    renderedPdfKey: null,
    renderedPdfUrl: null,
    licenseSchool: null,
    licenseType: null,
    licenseNumber: null,
    preparedJetskiId: null,
    preparedAssetId: null,
    preparedAssetType: null,
    ...patch,
  };
}

function makeTx(initialRows: Row[]) {
  const rows = initialRows.map((item) => ({ ...item }));

  const reservationContract = {
    findMany: async (args: { where?: { reservationId?: string } } = {}) =>
      rows
        .filter((item) => !args.where?.reservationId || item.reservationId === args.where.reservationId)
        .map((item) => ({
          ...item,
          preparedAsset: item.preparedAssetId ? { type: item.preparedAssetType } : null,
        })),
    update: async (args: { where: { id: string }; data: Partial<Row>; select?: { id?: boolean } }) => {
      const item = rows.find((candidate) => candidate.id === args.where.id);
      if (!item) throw new Error("Not found");
      Object.assign(item, args.data);
      return args.select?.id ? { id: item.id } : { ...item };
    },
    updateMany: async (args: { where: { id: { in: string[] } }; data: Partial<Row> }) => {
      let count = 0;
      for (const item of rows) {
        if (!args.where.id.in.includes(item.id)) continue;
        Object.assign(item, args.data);
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
        rows.push(
          row(`created-${item.logicalUnitIndex}`, "DRAFT", item.logicalUnitIndex, {
            reservationId: item.reservationId,
            unitIndex: item.unitIndex,
            templateCode: item.templateCode ?? null,
            templateVersion: null,
          })
        );
      }
      return { count: args.data.length };
    },
  };

  return {
    rows,
    tx: { reservationContract } as unknown as Prisma.TransactionClient,
  };
}

const licensedJetskiTarget = {
  templateCode: "JETSKI_LICENSED",
  requiresLicense: true,
  expectedResourceKind: "jetski" as const,
};

test("sync de 1 a 2 unidades crea un contrato DRAFT nuevo", async () => {
  const { tx, rows } = makeTx([row("contract-1", "DRAFT", 1)]);

  const result = await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 2,
    ...licensedJetskiTarget,
  });

  assert.equal(result.createdContracts, 1);
  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.logicalUnitIndex, 2);
  assert.equal(rows[1]?.status, "DRAFT");
  assert.equal(rows[1]?.templateCode, "JETSKI_LICENSED");
});

test("sync de 2 a 1 sin firmados invalida el contrato sobrante", async () => {
  const { tx, rows } = makeTx([
    row("contract-1", "DRAFT", 1),
    row("contract-2", "READY", 2),
  ]);

  const result = await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 1,
    ...licensedJetskiTarget,
  });

  assert.equal(result.voidedContracts, 1);
  assert.equal(rows.find((item) => item.id === "contract-1")?.status, "DRAFT");
  const surplus = rows.find((item) => item.id === "contract-2");
  assert.equal(surplus?.status, "VOID");
  assert.ok(surplus?.supersededAt);
});

test("sync JETSKI a actividad sin contrato invalida todos los no firmados y no recrea", async () => {
  const { tx, rows } = makeTx([
    row("contract-1", "DRAFT", 1, { templateCode: "JETSKI_NO_LICENSE" }),
    row("contract-2", "READY", 2, { templateCode: "JETSKI_NO_LICENSE" }),
  ]);

  const result = await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 0,
    templateCode: null,
    requiresLicense: false,
    expectedResourceKind: null,
  });

  assert.equal(result.createdContracts, 0);
  assert.equal(result.voidedContracts, 2);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((item) => item.id === "contract-1")?.status, "VOID");
  assert.equal(rows.find((item) => item.id === "contract-2")?.status, "VOID");
  assert.ok(rows.find((item) => item.id === "contract-1")?.supersededAt);
  assert.ok(rows.find((item) => item.id === "contract-2")?.supersededAt);
});

test("sync no crea contratos cuando requiredUnits es 0", async () => {
  const { tx, rows } = makeTx([]);

  const result = await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 0,
    templateCode: null,
    requiresLicense: false,
    expectedResourceKind: null,
  });

  assert.equal(result.createdContracts, 0);
  assert.equal(rows.length, 0);
});

test("sync de 2 a 1 con 1 SIGNED conserva firmado e invalida READY", async () => {
  const { tx, rows } = makeTx([
    row("signed-1", "SIGNED", 1),
    row("ready-2", "READY", 2),
  ]);

  await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 1,
    ...licensedJetskiTarget,
  });

  assert.equal(rows.find((item) => item.id === "signed-1")?.status, "SIGNED");
  assert.equal(rows.find((item) => item.id === "ready-2")?.status, "VOID");
});

test("sync de 2 a 1 con 2 SIGNED devuelve 409", async () => {
  const { tx } = makeTx([
    row("signed-1", "SIGNED", 1),
    row("signed-2", "SIGNED", 2),
  ]);

  await assert.rejects(
    () =>
      syncReservationContractsTx(tx, {
        reservationId: "reservation-1",
        requiredUnits: 1,
        ...licensedJetskiTarget,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ReservationContractSyncBlockedError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "SIGNED_CONTRACT_REDUCTION");
      return true;
    }
  );
});

test("sync resetea READY con cambio material sin bloquear", async () => {
  const { tx, rows } = makeTx([
    row("ready-1", "READY", 1, {
      renderedHtml: "<html>old</html>",
      renderedPdfKey: "old.pdf",
      renderedPdfUrl: "https://example.test/old.pdf",
    }),
  ]);

  await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 1,
    materialChange: true,
    ...licensedJetskiTarget,
  });

  const ready = rows.find((item) => item.id === "ready-1");
  assert.equal(ready?.status, "DRAFT");
  assert.equal(ready?.renderedHtml, null);
  assert.equal(ready?.renderedPdfKey, null);
  assert.equal(ready?.renderedPdfUrl, null);
});

test("sync JETSKI_LICENSED a BOAT_LICENSED invalida incompatible y crea reemplazo", async () => {
  const { tx, rows } = makeTx([
    row("jetski-1", "READY", 1, {
      templateCode: "JETSKI_LICENSED",
      preparedJetskiId: "jetski-a",
      renderedHtml: "<html>old</html>",
    }),
  ]);

  const result = await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 1,
    templateCode: "BOAT_LICENSED",
    requiresLicense: true,
    expectedResourceKind: "asset",
    expectedAssetType: "BOAT",
  });

  assert.equal(result.voidedContracts, 1);
  assert.equal(result.createdContracts, 1);
  const old = rows.find((item) => item.id === "jetski-1");
  assert.equal(old?.status, "VOID");
  assert.equal(old?.preparedJetskiId, null);
  assert.equal(old?.renderedHtml, null);
  assert.equal(rows.find((item) => item.id === "created-1")?.templateCode, "BOAT_LICENSED");
});

test("sync BOAT_LICENSED a JETSKI_LICENSED limpia asset incompatible", async () => {
  const { tx, rows } = makeTx([
    row("boat-1", "DRAFT", 1, {
      templateCode: "BOAT_LICENSED",
      preparedAssetId: "asset-boat",
      preparedAssetType: "BOAT",
    }),
  ]);

  await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 1,
    templateCode: "JETSKI_LICENSED",
    requiresLicense: true,
    expectedResourceKind: "jetski",
  });

  const old = rows.find((item) => item.id === "boat-1");
  assert.equal(old?.status, "VOID");
  assert.equal(old?.preparedAssetId, null);
});

test("sync a contrato sin licencia limpia datos de licencia en no firmados reseteados", async () => {
  const { tx, rows } = makeTx([
    row("draft-1", "DRAFT", 1, {
      templateCode: null,
      licenseSchool: "School",
      licenseType: "PER",
      licenseNumber: "123",
      preparedJetskiId: "jetski-a",
      renderedHtml: "<html>old</html>",
    }),
  ]);

  await syncReservationContractsTx(tx, {
    reservationId: "reservation-1",
    requiredUnits: 1,
    templateCode: "JETSKI_NO_LICENSE",
    requiresLicense: false,
    expectedResourceKind: null,
    materialChange: true,
  });

  const contract = rows.find((item) => item.id === "draft-1");
  assert.equal(contract?.status, "DRAFT");
  assert.equal(contract?.licenseSchool, null);
  assert.equal(contract?.licenseType, null);
  assert.equal(contract?.licenseNumber, null);
  assert.equal(contract?.preparedJetskiId, null);
  assert.equal(contract?.renderedHtml, null);
});
