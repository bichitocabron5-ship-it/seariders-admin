import assert from "node:assert/strict";
import test from "node:test";

import {
  buildComparableContractComposition,
  buildExistingReservationContractComposition,
  hasSignedContractBlockingChange,
  resolveSignedContractMaterialChangePolicy,
  sameContractComposition,
  shouldSyncReservationBeforeFormalize,
} from "./signed-contract-formalization";
import { resolvePrepaidVoucherCommercialChange } from "./reservation-commercial-snapshot";

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

test("reserva sin contratos firmados y sin cambios pendientes formaliza sin update previo", () => {
  assert.equal(
    shouldSyncReservationBeforeFormalize({
      hasSignedContracts: false,
      hasPendingReservationChanges: false,
    }),
    false
  );
});

test("reserva sin contratos firmados sincroniza solo si hay cambios pendientes", () => {
  assert.equal(
    shouldSyncReservationBeforeFormalize({
      hasSignedContracts: false,
      hasPendingReservationChanges: true,
    }),
    true
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

test("BOOTH SIGNED sin cambios reales no bloquea ni marca sync material", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: true,
    scheduleChanged: false,
    compositionChanged: false,
    protectedNonScheduleFieldsChanged: false,
  });

  assert.deepEqual(decision, {
    signedContractBlockingChange: false,
    protectedContractContentChanged: false,
    syncMaterialChange: false,
    blockSignedOnSyncMaterialChange: false,
  });
});

test("BOOTH SIGNED con solo fecha/hora refresca no firmados sin bloquear firmados", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: true,
    scheduleChanged: true,
    compositionChanged: false,
    protectedNonScheduleFieldsChanged: false,
  });

  assert.deepEqual(decision, {
    signedContractBlockingChange: false,
    protectedContractContentChanged: false,
    syncMaterialChange: true,
    blockSignedOnSyncMaterialChange: false,
  });
});

test("BOOTH SIGNED con cambio de cantidad bloquea como cambio contractual real", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: true,
    scheduleChanged: false,
    compositionChanged: true,
    protectedNonScheduleFieldsChanged: false,
  });

  assert.equal(decision.signedContractBlockingChange, true);
  assert.equal(decision.blockSignedOnSyncMaterialChange, true);
});

test("SIGNED con cambio de precio de item bloquea", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: true,
    scheduleChanged: false,
    compositionChanged: false,
    protectedNonScheduleFieldsChanged: false,
    itemMaterialChanged: true,
  });

  assert.equal(decision.signedContractBlockingChange, true);
  assert.equal(decision.blockSignedOnSyncMaterialChange, true);
});

test("SIGNED con cambio de descuento bloquea", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: true,
    scheduleChanged: false,
    compositionChanged: false,
    protectedNonScheduleFieldsChanged: false,
    commercialContentChanged: true,
  });

  assert.equal(decision.signedContractBlockingChange, true);
  assert.equal(decision.syncMaterialChange, true);
  assert.equal(decision.blockSignedOnSyncMaterialChange, true);
});

test("SIGNED con cambio de promocion bloquea", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: true,
    scheduleChanged: false,
    compositionChanged: false,
    protectedNonScheduleFieldsChanged: true,
  });

  assert.equal(decision.signedContractBlockingChange, true);
  assert.equal(decision.blockSignedOnSyncMaterialChange, true);
});

test("SIGNED con cambio de tarifa bloquea", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: true,
    scheduleChanged: false,
    compositionChanged: false,
    protectedNonScheduleFieldsChanged: false,
    itemMaterialChanged: true,
  });

  assert.equal(decision.signedContractBlockingChange, true);
  assert.equal(decision.blockSignedOnSyncMaterialChange, true);
});

test("BOOTH sin firmar no bloquea aunque haya cambio de composicion", () => {
  const decision = resolveSignedContractMaterialChangePolicy({
    hasSignedContracts: false,
    scheduleChanged: false,
    compositionChanged: true,
    protectedNonScheduleFieldsChanged: false,
  });

  assert.equal(decision.signedContractBlockingChange, false);
  assert.equal(decision.protectedContractContentChanged, true);
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

test("regalo pagado SIGNED sin cambios no bloquea por canal autoinferido", () => {
  const existingComposition = buildExistingReservationContractComposition({
    serviceId: "service-gift",
    optionId: "option-30",
    quantity: 1,
    pax: 1,
    items: [
      {
        serviceId: "service-gift",
        optionId: "option-30",
        quantity: 1,
        pax: 1,
        isExtra: false,
      },
    ],
  });
  const nextComposition = buildComparableContractComposition([
    {
      serviceId: "service-gift",
      optionId: "option-30",
      quantity: 1,
      pax: 1,
    },
  ]);
  const compositionChanged = !sameContractComposition(existingComposition, nextComposition);
  const commercialChange = resolvePrepaidVoucherCommercialChange({
    isPrepaidVoucherReservation: true,
    currentChannelId: null,
    requestedChannelId: "direct-channel",
    commercialPricingChanged: true,
  });
  const protectedNonScheduleFieldsChanged =
    commercialChange.channelChanged || commercialChange.commercialPricingChanged;

  assert.equal(compositionChanged, false);
  assert.equal(protectedNonScheduleFieldsChanged, false);
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged,
      protectedNonScheduleFieldsChanged,
    }),
    false
  );
});

test("regalo pagado SIGNED con solo fecha/hora no bloquea", () => {
  assert.equal(
    hasSignedContractBlockingChange({
      hasSignedContracts: true,
      compositionChanged: false,
      protectedNonScheduleFieldsChanged: false,
    }),
    false
  );
});

test("regalo pagado SIGNED con cambio de cantidad bloquea", () => {
  const existingComposition = buildExistingReservationContractComposition({
    serviceId: "service-gift",
    optionId: "option-30",
    quantity: 1,
    pax: 1,
    items: [
      {
        serviceId: "service-gift",
        optionId: "option-30",
        quantity: 1,
        pax: 1,
        isExtra: false,
      },
    ],
  });
  const nextComposition = buildComparableContractComposition([
    {
      serviceId: "service-gift",
      optionId: "option-30",
      quantity: 2,
      pax: 1,
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

test("regalo pagado SIGNED con cambio de actividad bloquea", () => {
  const existingComposition = buildExistingReservationContractComposition({
    serviceId: "service-gift",
    optionId: "option-30",
    quantity: 1,
    pax: 1,
    items: [
      {
        serviceId: "service-gift",
        optionId: "option-30",
        quantity: 1,
        pax: 1,
        isExtra: false,
      },
    ],
  });
  const nextComposition = buildComparableContractComposition([
    {
      serviceId: "service-other",
      optionId: "option-30",
      quantity: 1,
      pax: 1,
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
