import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSignedContractBlockingChange,
  shouldSyncReservationBeforeFormalize,
} from "./signed-contract-formalization";

test("reserva WEB pagada con contrato SIGNED y sin cambios pendientes formaliza sin sync de edicion", () => {
  assert.equal(
    shouldSyncReservationBeforeFormalize({
      hasSignedContracts: true,
      hasPendingReservationChanges: false,
    }),
    false
  );
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged: false,
      protectedNonScheduleFieldsChanged: false,
    }),
    false
  );
});

test("contrato SIGNED con cambio de cantidad bloquea", () => {
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged: true,
      protectedNonScheduleFieldsChanged: false,
    }),
    true
  );
});

test("contrato SIGNED con cambio de actividad bloquea", () => {
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged: true,
      protectedNonScheduleFieldsChanged: false,
    }),
    true
  );
});

test("contrato SIGNED con solo fecha/hora permite continuar", () => {
  assert.equal(
    shouldSyncReservationBeforeFormalize({
      hasSignedContracts: true,
      hasPendingReservationChanges: true,
    }),
    true
  );
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged: false,
      protectedNonScheduleFieldsChanged: false,
    }),
    false
  );
});
