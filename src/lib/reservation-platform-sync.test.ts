import assert from "node:assert/strict";
import test from "node:test";

import { ReservationUnitStatus } from "@prisma/client";

import { buildOperationalUnitSnapshots } from "./reservation-operational-units";
import { computeReservationUnitSyncPlan } from "./reservation-platform-sync";

test("JetSki + Wakeboard genera unidades operativas separadas por item", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "JetSki", category: "JETSKI" },
        option: { id: "opt-30", durationMinutes: 30 },
      },
      {
        id: "item-wakeboard",
        quantity: 1,
        pax: 1,
        isExtra: false,
        service: { id: "svc-wake", name: "Wakeboard", category: "TOWABLE" },
        option: { id: "opt-15", durationMinutes: 15 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 1,
      service: null,
      option: null,
    },
  });

  assert.equal(units.length, 2);
  assert.deepEqual(
    units.map((unit) => ({
      unitIndex: unit.unitIndex,
      reservationItemId: unit.reservationItemId,
      serviceCategory: unit.serviceCategory,
    })),
    [
      { unitIndex: 1, reservationItemId: "item-jetski", serviceCategory: "JETSKI" },
      { unitIndex: 2, reservationItemId: "item-wakeboard", serviceCategory: "TOWABLE" },
    ]
  );
});

test("re-sync de unidades no duplica filas existentes", () => {
  const requiredUnits = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "JetSki", category: "JETSKI" },
        option: { id: "opt-30", durationMinutes: 30 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 1,
      service: null,
      option: null,
    },
  });

  const plan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits: [
      {
        id: "unit-1",
        unitIndex: 1,
        status: ReservationUnitStatus.WAITING,
      },
    ],
  });

  assert.equal(plan.creates.length, 0);
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.extraUnitIds, []);
});

test("ReservationUnit WAITING pasa a READY_FOR_PLATFORM cuando la reserva padre ya está lista", () => {
  const readyAt = new Date("2026-05-26T10:00:00.000Z");
  const requiredUnits = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "JetSki", category: "JETSKI" },
        option: { id: "opt-30", durationMinutes: 30 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 1,
      service: null,
      option: null,
    },
  });

  const plan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits: [
      {
        id: "unit-1",
        unitIndex: 1,
        status: ReservationUnitStatus.WAITING,
      },
    ],
    readyAt,
  });

  assert.equal(plan.creates.length, 0);
  assert.equal(plan.updates.length, 1);
  assert.equal(
    plan.updates[0]?.data.status,
    ReservationUnitStatus.READY_FOR_PLATFORM
  );
  assert.equal(plan.updates[0]?.data.readyForPlatformAt?.toISOString(), readyAt.toISOString());
});

test("extras no generan unidades operativas", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-extra",
        quantity: 3,
        pax: 1,
        isExtra: true,
        service: { id: "svc-extra", name: "Foto", category: "EXTRA" },
        option: { id: "opt-extra", durationMinutes: 5 },
      },
    ],
    fallback: {
      quantity: 0,
      pax: 0,
      service: null,
      option: null,
    },
  });

  assert.equal(units.length, 0);
});
