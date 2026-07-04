import assert from "node:assert/strict";
import test from "node:test";

import {
  buildComparableContractComposition,
  buildExistingReservationContractComposition,
  hasSignedContractBlockingChange,
  sameContractComposition,
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

test("reserva legacy SIGNED sin optionId en items permite solo cambio de fecha/hora", () => {
  const existingComposition = buildExistingReservationContractComposition({
    serviceId: "service-jetski",
    optionId: "option-30",
    quantity: 2,
    pax: 2,
    items: [
      {
        serviceId: "service-jetski",
        optionId: null,
        quantity: 2,
        pax: 2,
        isExtra: false,
      },
    ],
  });
  const nextComposition = buildComparableContractComposition([
    {
      serviceId: "service-jetski",
      optionId: "option-30",
      quantity: 2,
      pax: 2,
    },
  ]);
  const compositionChanged = !sameContractComposition(existingComposition, nextComposition);

  assert.equal(compositionChanged, false);
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged,
      protectedNonScheduleFieldsChanged: false,
    }),
    false
  );
});

test("reserva legacy SIGNED sigue bloqueando cambios reales de composicion", () => {
  const existingComposition = buildExistingReservationContractComposition({
    serviceId: "service-jetski",
    optionId: "option-30",
    quantity: 2,
    pax: 2,
    items: [
      {
        serviceId: "service-jetski",
        optionId: null,
        quantity: 2,
        pax: 2,
        isExtra: false,
      },
    ],
  });
  const nextComposition = buildComparableContractComposition([
    {
      serviceId: "service-jetski",
      optionId: "option-60",
      quantity: 2,
      pax: 2,
    },
  ]);
  const compositionChanged = !sameContractComposition(existingComposition, nextComposition);

  assert.equal(compositionChanged, true);
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged,
      protectedNonScheduleFieldsChanged: false,
    }),
    true
  );
});

test("contrato SIGNED sigue bloqueando cambios protegidos de licencia o datos legales", () => {
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged: false,
      protectedNonScheduleFieldsChanged: true,
    }),
    true
  );
});

test("composicion moderna conserva el optionId del item", () => {
  const existingComposition = buildExistingReservationContractComposition({
    serviceId: "legacy-service",
    optionId: "legacy-option",
    quantity: 1,
    pax: 1,
    items: [
      {
        serviceId: "modern-service",
        optionId: "modern-option",
        quantity: 1,
        pax: 1,
        isExtra: false,
      },
    ],
  });
  const nextComposition = buildComparableContractComposition([
    {
      serviceId: "modern-service",
      optionId: "modern-option",
      quantity: 1,
      pax: 1,
    },
  ]);

  assert.equal(sameContractComposition(existingComposition, nextComposition), true);
});
