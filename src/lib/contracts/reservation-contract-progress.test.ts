import assert from "node:assert/strict";
import test from "node:test";

import { buildReservationContractProgressFromReservation } from "./reservation-contract-progress";

test("progreso de contratos cuenta el contrato asociado al ReservationItem correcto", () => {
  const progress = buildReservationContractProgressFromReservation({
    quantity: 2,
    isLicense: false,
    service: { name: "Banana padre", category: "TOWABLE" },
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        isExtra: false,
        service: { name: "Jetski", category: "JETSKI" },
      },
      {
        id: "item-banana",
        quantity: 1,
        isExtra: false,
        service: { name: "Banana", category: "TOWABLE" },
      },
    ],
    contracts: [
      {
        reservationItemId: "item-banana",
        logicalUnitIndex: 1,
        unitIndex: 1,
        status: "READY",
      },
    ],
  });

  assert.equal(progress.requiredUnits, 1);
  assert.equal(progress.readyCount, 0);
  assert.equal(progress.needsContracts, true);
});

test("progreso de contratos moderno acepta READY del item requerido", () => {
  const progress = buildReservationContractProgressFromReservation({
    quantity: 2,
    isLicense: false,
    service: { name: "Banana padre", category: "TOWABLE" },
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        isExtra: false,
        service: { name: "Jetski", category: "JETSKI" },
      },
      {
        id: "item-banana",
        quantity: 1,
        isExtra: false,
        service: { name: "Banana", category: "TOWABLE" },
      },
    ],
    contracts: [
      {
        reservationItemId: "item-jetski",
        logicalUnitIndex: 1,
        unitIndex: 1,
        status: "READY",
      },
    ],
  });

  assert.equal(progress.requiredUnits, 1);
  assert.equal(progress.readyCount, 1);
  assert.equal(progress.needsContracts, false);
});

test("progreso de contratos conserva fallback legacy sin items", () => {
  const progress = buildReservationContractProgressFromReservation({
    quantity: 1,
    isLicense: false,
    service: { name: "Jetski legacy", category: "JETSKI" },
    items: [],
    contracts: [
      {
        reservationItemId: null,
        logicalUnitIndex: 1,
        unitIndex: 1,
        status: "SIGNED",
      },
    ],
  });

  assert.equal(progress.requiredUnits, 1);
  assert.equal(progress.readyCount, 1);
});
