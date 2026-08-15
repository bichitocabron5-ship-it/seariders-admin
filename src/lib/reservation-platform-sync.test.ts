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

test("pack Jetski 20 + Banana 15 crea unidad Jetski y unidad Nautica con duracion propia", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-pack-parent",
        quantity: 1,
        pax: 2,
        isExtra: false,
        isPackParent: true,
        service: { id: "svc-pack", name: "Pack", category: "PACK" },
        option: { id: "opt-pack", durationMinutes: 0 },
      },
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
      {
        id: "item-banana",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
        option: { id: "opt-banana-15", durationMinutes: 15 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      isPackParent: true,
      service: { id: "svc-pack", name: "Pack", category: "PACK" },
      option: { id: "opt-pack", durationMinutes: 0 },
    },
  });

  assert.deepEqual(
    units.map((unit) => ({
      reservationItemId: unit.reservationItemId,
      serviceCategory: unit.serviceCategory,
      durationMinutesSnapshot: unit.durationMinutesSnapshot,
    })),
    [
      {
        reservationItemId: "item-jetski",
        serviceCategory: "JETSKI",
        durationMinutesSnapshot: 20,
      },
      {
        reservationItemId: "item-banana",
        serviceCategory: "NAUTICA",
        durationMinutesSnapshot: 15,
      },
    ]
  );
});

test("carrito Banana primero y Jetski despues conserva las dos areas operativas", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-banana",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
        option: { id: "opt-banana-15", durationMinutes: 15 },
      },
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: null,
      option: null,
    },
  });

  assert.deepEqual(
    units
      .map((unit) => `${unit.serviceCategory}:${unit.durationMinutesSnapshot}`)
      .sort(),
    ["JETSKI:20", "NAUTICA:15"]
  );
});

test("carrito Jetski primero y Banana despues conserva las dos areas operativas", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
      {
        id: "item-banana",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
        option: { id: "opt-banana-15", durationMinutes: 15 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: null,
      option: null,
    },
  });

  assert.deepEqual(
    units
      .map((unit) => `${unit.serviceCategory}:${unit.durationMinutesSnapshot}`)
      .sort(),
    ["JETSKI:20", "NAUTICA:15"]
  );
});

test("dos lineas Jetski con duraciones distintas conservan snapshot por linea", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski-20",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
      {
        id: "item-jetski-40",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-40", durationMinutes: 40 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: null,
      option: null,
    },
  });

  assert.deepEqual(
    units.map((unit) => [unit.reservationItemId, unit.durationMinutesSnapshot]),
    [
      ["item-jetski-20", 20],
      ["item-jetski-40", 40],
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

test("reducir quantity Jetski cancela solo la unidad sobrante de esa linea", () => {
  const requiredUnits = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
      {
        id: "item-banana",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
        option: { id: "opt-banana-15", durationMinutes: 15 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: null,
      option: null,
    },
  });

  const plan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits: [
      {
        id: "unit-jetski-1",
        unitIndex: 1,
        reservationItemId: "item-jetski",
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
      },
      {
        id: "unit-jetski-2",
        unitIndex: 2,
        reservationItemId: "item-jetski",
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
      },
      {
        id: "unit-banana",
        unitIndex: 3,
        reservationItemId: "item-banana",
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
      },
    ],
  });

  assert.deepEqual(plan.extraUnitIds, ["unit-jetski-2"]);
  assert.equal(plan.updates.some((update) => update.id === "unit-banana"), true);
});

test("quitar Banana no elimina Jetski", () => {
  const requiredUnits = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: null,
      option: null,
    },
  });

  const plan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits: [
      {
        id: "unit-jetski",
        unitIndex: 1,
        reservationItemId: "item-jetski",
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
      },
      {
        id: "unit-banana",
        unitIndex: 2,
        reservationItemId: "item-banana",
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
      },
    ],
  });

  assert.deepEqual(plan.extraUnitIds, ["unit-banana"]);
  assert.equal(plan.updates.some((update) => update.id === "unit-jetski"), true);
});

test("componentes de pack no marcados como extras son unidades operativas reales", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
      {
        id: "item-banana",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
        option: { id: "opt-banana-15", durationMinutes: 15 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      isPackParent: true,
      service: { id: "svc-pack", name: "Pack", category: "PACK" },
      option: { id: "opt-pack", durationMinutes: 0 },
    },
  });

  assert.equal(units.length, 2);
  assert.deepEqual(
    units.map((unit) => unit.reservationItemId).sort(),
    ["item-banana", "item-jetski"]
  );
});

test("tras pago ready crea cola Jetski Plataforma y Banana Nautica sin duplicar", () => {
  const readyAt = new Date("2026-07-27T10:00:00.000Z");
  const requiredUnits = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
      {
        id: "item-banana",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
        option: { id: "opt-banana-15", durationMinutes: 15 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: null,
      option: null,
    },
  });

  const firstPlan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits: [],
    readyAt,
  });
  assert.deepEqual(
    firstPlan.creates.map((create) => ({
      status: create.status,
      category: create.data.serviceCategory,
      duration: create.data.durationMinutesSnapshot,
      readyAt: create.data.readyForPlatformAt?.toISOString(),
    })),
    [
      {
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
        category: "JETSKI",
        duration: 20,
        readyAt: readyAt.toISOString(),
      },
      {
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
        category: "NAUTICA",
        duration: 15,
        readyAt: readyAt.toISOString(),
      },
    ]
  );

  const pollingPlan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits: firstPlan.creates.map((create, index) => ({
      id: `unit-${index + 1}`,
      unitIndex: create.unitIndex,
      reservationItemId: create.data.reservationItemId,
      status: create.status,
    })),
    readyAt,
  });
  assert.equal(pollingPlan.creates.length, 0);
  assert.deepEqual(pollingPlan.extraUnitIds, []);
});

test("reserva simple moderna sigue creando unidad operativa", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-20", durationMinutes: 20 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: null,
      option: null,
    },
  });

  assert.equal(units.length, 1);
  assert.equal(units[0]?.reservationItemId, "item-jetski");
  assert.equal(units[0]?.serviceCategory, "JETSKI");
});

test("reserva legacy sin ReservationItem usa fallback seguro", () => {
  const units = buildOperationalUnitSnapshots({
    items: [],
    fallback: {
      quantity: 1,
      pax: 2,
      service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
      option: { id: "opt-jetski-20", durationMinutes: 20 },
    },
  });

  assert.equal(units.length, 1);
  assert.equal(units[0]?.reservationItemId, null);
  assert.equal(units[0]?.serviceCategory, "JETSKI");
  assert.equal(units[0]?.durationMinutesSnapshot, 20);
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

test("reserva legacy con solo extras usa fallback seguro de la reserva", () => {
  const units = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-extra",
        quantity: 1,
        pax: 1,
        isExtra: true,
        service: { id: "svc-extra", name: "Foto", category: "EXTRA" },
        option: { id: "opt-extra", durationMinutes: 5 },
      },
    ],
    fallback: {
      quantity: 1,
      pax: 2,
      service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
      option: { id: "opt-jetski-60", durationMinutes: 60 },
    },
  });

  assert.equal(units.length, 1);
  assert.equal(units[0]?.reservationItemId, null);
  assert.equal(units[0]?.durationMinutesSnapshot, 60);
});

test("editar una linea conserva la duracion de las otras unidades por reservationItemId", () => {
  const requiredUnits = buildOperationalUnitSnapshots({
    items: [
      {
        id: "item-jetski",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        option: { id: "opt-jetski-60", durationMinutes: 60 },
      },
      {
        id: "item-banana",
        quantity: 1,
        pax: 2,
        isExtra: false,
        service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
        option: { id: "opt-banana-15", durationMinutes: 15 },
      },
    ],
    fallback: {
      quantity: 2,
      pax: 2,
      service: null,
      option: null,
    },
  });

  const plan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits: [
      {
        id: "unit-jetski",
        unitIndex: 1,
        reservationItemId: "item-jetski",
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
      },
      {
        id: "unit-banana",
        unitIndex: 2,
        reservationItemId: "item-banana",
        status: ReservationUnitStatus.READY_FOR_PLATFORM,
      },
    ],
  });

  assert.deepEqual(
    plan.updates.map((update) => [
      update.id,
      update.data.reservationItemId,
      update.data.durationMinutesSnapshot,
    ]),
    [
      ["unit-jetski", "item-jetski", 60],
      ["unit-banana", "item-banana", 15],
    ]
  );
});
