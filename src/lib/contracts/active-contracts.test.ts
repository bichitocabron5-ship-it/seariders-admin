import assert from "node:assert/strict";
import test from "node:test";

import {
  canEditReservationLegalContent,
  countLockedVisibleContracts,
  countReadyVisibleContracts,
  listMissingLogicalUnits,
  pickVisibleContractsByLogicalUnit,
} from "./active-contracts";

function contract(status: "DRAFT" | "READY" | "SIGNED" | "VOID", logicalUnitIndex = 1) {
  return {
    unitIndex: logicalUnitIndex,
    logicalUnitIndex,
    status,
    supersededAt: null,
    createdAt: new Date(`2026-06-30T10:0${logicalUnitIndex}:00.000Z`),
  };
}

test("reserva con contratos READY permite editar cantidad, duracion y servicio si no hay SIGNED", () => {
  const contracts = [contract("READY")];

  assert.equal(canEditReservationLegalContent(contracts, 1), true);
  assert.equal(countLockedVisibleContracts(contracts, 1), 0);
});

test("reserva con contratos SIGNED sigue bloqueando cambios legales", () => {
  const contracts = [contract("SIGNED")];

  assert.equal(canEditReservationLegalContent(contracts, 1), false);
  assert.equal(countLockedVisibleContracts(contracts, 1), 1);
});

test("reserva con contrato DRAFT sigue editable", () => {
  const contracts = [contract("DRAFT")];

  assert.equal(canEditReservationLegalContent(contracts, 1), true);
  assert.equal(countLockedVisibleContracts(contracts, 1), 0);
});

test("READY cuenta como preparado pero no como locked", () => {
  const contracts = [contract("READY")];

  assert.equal(countReadyVisibleContracts(contracts, 1), 1);
  assert.equal(countLockedVisibleContracts(contracts, 1), 0);
});

test("VOID y superseded no aparecen como contratos activos", () => {
  const contracts = [
    contract("VOID", 1),
    { ...contract("READY", 2), supersededAt: new Date("2026-06-30T11:00:00.000Z") },
  ];

  assert.deepEqual(pickVisibleContractsByLogicalUnit(contracts, 2), []);
  assert.deepEqual(listMissingLogicalUnits(contracts, 2), [1, 2]);
  assert.equal(countReadyVisibleContracts(contracts, 2), 0);
});

test("requiredUnits 0 no expone contratos activos aunque existan filas antiguas", () => {
  const contracts = [contract("DRAFT", 1), contract("READY", 2), contract("SIGNED", 3)];

  assert.deepEqual(pickVisibleContractsByLogicalUnit(contracts, 0), []);
  assert.deepEqual(listMissingLogicalUnits(contracts, 0), []);
  assert.equal(countReadyVisibleContracts(contracts, 0), 0);
  assert.equal(countLockedVisibleContracts(contracts, 0), 0);
});
