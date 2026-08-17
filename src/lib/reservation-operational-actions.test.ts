import assert from "node:assert/strict";
import test from "node:test";

import { ReservationStatus, ReservationUnitStatus } from "@prisma/client";

import { evaluateManualMarkInSea } from "./reservation-operational-actions";

test("mark_in_sea manual bloquea reservas con unidades de Platform pendientes", () => {
  const decision = evaluateManualMarkInSea({
    reservationStatus: ReservationStatus.READY_FOR_PLATFORM,
    units: [{ status: ReservationUnitStatus.READY_FOR_PLATFORM }],
    openAssignmentCount: 0,
  });

  assert.equal(decision.ok, false);
  if (!decision.ok) {
    assert.match(decision.error, /unidades de Platform/);
  }
});

test("mark_in_sea manual permite solo fallback legacy sin unidades ni asignaciones", () => {
  const decision = evaluateManualMarkInSea({
    reservationStatus: ReservationStatus.READY_FOR_PLATFORM,
    units: [],
    openAssignmentCount: 0,
  });

  assert.deepEqual(decision, { ok: true, alreadyInSea: false, legacyFallback: true });
});

test("mark_in_sea manual bloquea asignaciones abiertas aunque no haya unidades", () => {
  const decision = evaluateManualMarkInSea({
    reservationStatus: ReservationStatus.READY_FOR_PLATFORM,
    units: [],
    openAssignmentCount: 1,
  });

  assert.equal(decision.ok, false);
  if (!decision.ok) {
    assert.match(decision.error, /asignaciones/);
  }
});

test("mark_in_sea manual es idempotente con salida parcial ya agregada IN_SEA", () => {
  const decision = evaluateManualMarkInSea({
    reservationStatus: ReservationStatus.IN_SEA,
    units: [
      { status: ReservationUnitStatus.IN_SEA },
      { status: ReservationUnitStatus.READY_FOR_PLATFORM },
    ],
    openAssignmentCount: 1,
  });

  assert.deepEqual(decision, { ok: true, alreadyInSea: true, legacyFallback: false });
});

test("mark_in_sea manual es idempotente cuando todas las unidades ya estan IN_SEA", () => {
  const decision = evaluateManualMarkInSea({
    reservationStatus: ReservationStatus.IN_SEA,
    units: [
      { status: ReservationUnitStatus.IN_SEA },
      { status: ReservationUnitStatus.IN_SEA },
    ],
    openAssignmentCount: 0,
  });

  assert.deepEqual(decision, { ok: true, alreadyInSea: true, legacyFallback: false });
});

test("mark_in_sea idempotente no solicita fallback legacy ni mutaciones operativas", () => {
  const decision = evaluateManualMarkInSea({
    reservationStatus: ReservationStatus.IN_SEA,
    units: [],
    openAssignmentCount: 0,
  });

  assert.deepEqual(decision, { ok: true, alreadyInSea: true, legacyFallback: false });
});
