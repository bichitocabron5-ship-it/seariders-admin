import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePublicContractAccess } from "./public-contract-access";

function contract(
  id: string,
  status: "DRAFT" | "READY" | "SIGNED" | "VOID",
  patch: {
    reservationId?: string;
    reservationItemId?: string | null;
    logicalUnitIndex?: number;
    supersededAt?: Date | null;
    reservationItemReservationId?: string | null;
  } = {}
) {
  const reservationItemId = patch.reservationItemId ?? null;
  return {
    id,
    reservationId: patch.reservationId ?? "reservation-1",
    reservationItemId,
    unitIndex: patch.logicalUnitIndex ?? 1,
    logicalUnitIndex: patch.logicalUnitIndex ?? 1,
    status,
    supersededAt: patch.supersededAt ?? null,
    createdAt: new Date("2026-06-30T09:00:00.000Z"),
    reservationItem: reservationItemId
      ? {
          id: reservationItemId,
          reservationId: patch.reservationItemReservationId ?? "reservation-1",
        }
      : null,
  };
}

function reservation(contracts: ReturnType<typeof contract>[]) {
  return {
    id: "reservation-1",
    quantity: 2,
    isLicense: false,
    serviceId: "pack-service",
    optionId: "pack-option",
    pax: 2,
    totalPriceCents: 18_000,
    service: { name: "Pack", category: "PACK" },
    option: { durationMinutes: 35 },
    items: [
      {
        id: "item-banana",
        reservationId: "reservation-1",
        serviceId: "service-banana",
        optionId: "option-banana",
        quantity: 1,
        pax: 2,
        totalPriceCents: 8_000,
        isExtra: false,
        service: { name: "Banana", category: "NAUTICA" },
        option: { durationMinutes: 15 },
      },
      {
        id: "item-jetski",
        reservationId: "reservation-1",
        serviceId: "service-jetski",
        optionId: "option-jetski",
        quantity: 1,
        pax: 2,
        totalPriceCents: 10_000,
        isExtra: false,
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 20 },
      },
    ],
    contracts,
  };
}

test("token valido puede acceder a contrato activo vinculado a ReservationItem", () => {
  const linked = contract("contract-jetski", "SIGNED", {
    reservationItemId: "item-jetski",
  });

  const result = evaluatePublicContractAccess({
    reservation: reservation([linked]),
    contract: linked,
  });

  assert.equal(result.ok, true);
});

test("contrato legacy con reservationItemId null sigue siendo visible por slot seguro", () => {
  const legacy = contract("contract-legacy", "READY");

  const result = evaluatePublicContractAccess({
    reservation: reservation([legacy]),
    contract: legacy,
  });

  assert.equal(result.ok, true);
});

test("reservationItemId de otra reserva se rechaza", () => {
  const linkedElsewhere = contract("contract-jetski", "READY", {
    reservationItemId: "item-jetski",
    reservationItemReservationId: "reservation-2",
  });

  const result = evaluatePublicContractAccess({
    reservation: reservation([linkedElsewhere]),
    contract: linkedElsewhere,
  });

  assert.deepEqual(result, {
    ok: false,
    code: "CONTRACT_RESERVATION_ITEM_MISMATCH",
  });
});

test("contrato VOID o superseded se rechaza aunque el token sea valido", () => {
  const voidContract = contract("contract-void", "VOID", {
    reservationItemId: "item-jetski",
  });
  const superseded = contract("contract-superseded", "READY", {
    reservationItemId: "item-jetski",
    supersededAt: new Date("2026-06-30T10:00:00.000Z"),
  });

  assert.deepEqual(
    evaluatePublicContractAccess({
      reservation: reservation([voidContract]),
      contract: voidContract,
    }),
    { ok: false, code: "CONTRACT_INACTIVE" }
  );
  assert.deepEqual(
    evaluatePublicContractAccess({
      reservation: reservation([superseded]),
      contract: superseded,
    }),
    { ok: false, code: "CONTRACT_INACTIVE" }
  );
});
