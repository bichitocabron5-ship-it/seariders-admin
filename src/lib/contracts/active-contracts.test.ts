import assert from "node:assert/strict";
import test from "node:test";

import {
  canEditReservationLegalContent,
  countLockedVisibleContracts,
  countReadyVisibleContracts,
} from "./active-contracts";

function contract(status: "DRAFT" | "READY" | "SIGNED", logicalUnitIndex = 1) {
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
