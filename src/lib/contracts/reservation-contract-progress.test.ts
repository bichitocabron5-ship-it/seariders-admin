import assert from "node:assert/strict";
import test from "node:test";

import { buildReservationContractProgress } from "./reservation-contract-progress";

function contract(
  id: string,
  status: "DRAFT" | "READY" | "SIGNED" | "VOID",
  logicalUnitIndex: number,
  patch: {
    supersededAt?: Date | null;
    createdAt?: Date;
  } = {}
) {
  return {
    id,
    unitIndex: logicalUnitIndex,
    logicalUnitIndex,
    status,
    supersededAt: null,
    createdAt: new Date(`2026-06-30T10:0${logicalUnitIndex}:00.000Z`),
    ...patch,
  };
}

test("respuesta de update expone requiredUnits y contratos activos finales coherentes", () => {
  const progress = buildReservationContractProgress(
    [
      contract("contract-1", "DRAFT", 1),
      contract("contract-2", "VOID", 2, { supersededAt: new Date("2026-06-30T11:00:00.000Z") }),
    ],
    1
  );

  assert.equal(progress.requiredUnits, 1);
  assert.equal(progress.readyCount, 0);
  assert.equal(progress.needsContracts, true);
  assert.equal(progress.contractsState, "MISSING");
  assert.deepEqual(
    progress.contracts.map((item) => item.id),
    ["contract-1"]
  );
});

test("respuesta de update para requiredUnits 0 no exige ni muestra contratos", () => {
  const progress = buildReservationContractProgress(
    [
      contract("contract-1", "VOID", 1, { supersededAt: new Date("2026-06-30T11:00:00.000Z") }),
      contract("contract-2", "VOID", 2, { supersededAt: new Date("2026-06-30T11:00:00.000Z") }),
    ],
    0
  );

  assert.equal(progress.requiredUnits, 0);
  assert.equal(progress.readyCount, 0);
  assert.equal(progress.needsContracts, false);
  assert.equal(progress.contractsState, "OK");
  assert.deepEqual(progress.contracts, []);
});
