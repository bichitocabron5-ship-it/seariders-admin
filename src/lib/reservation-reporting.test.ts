import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateCentsByWeights,
  buildReservationActivityMetricLines,
  buildReservationActivityMetricRows,
} from "./reservation-reporting";

function byService<T extends { service: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.service, row]));
}

test("KPI por actividad usa ReservationItem en reserva moderna simple", () => {
  const rows = buildReservationActivityMetricRows([
    {
      service: { name: "Banana padre", category: "TOWABLE" },
      quantity: 9,
      soldTotalCents: 12_000,
      collectedCents: 12_000,
      pendingCents: 0,
      items: [
        {
          quantity: 1,
          totalPriceCents: 12_000,
          service: { name: "Jetski", category: "JETSKI" },
        },
      ],
    },
  ]);

  assert.deepEqual(rows.map((row) => row.service), ["Jetski"]);
  assert.equal(rows[0]?.quantity, 1);
  assert.equal(rows[0]?.salesCents, 12_000);
});

test("KPI legacy sin items usa Reservation.service como fallback", () => {
  const rows = buildReservationActivityMetricRows([
    {
      service: { name: "Jetski legacy", category: "JETSKI" },
      quantity: 2,
      soldTotalCents: 18_000,
      collectedCents: 10_000,
      pendingCents: 8_000,
      items: [],
    },
  ]);

  assert.equal(rows[0]?.service, "Jetski legacy");
  assert.equal(rows[0]?.quantity, 2);
  assert.equal(rows[0]?.salesCents, 18_000);
});

test("Pack Jetski 20 + Banana 15 reparte KPI por items sin duplicar venta", () => {
  const lines = buildReservationActivityMetricLines({
    service: { name: "Pack padre", category: "PACK" },
    quantity: 1,
    soldTotalCents: 15_000,
    collectedCents: 15_000,
    pendingCents: 0,
    items: [
      {
        isPackParent: true,
        quantity: 1,
        totalPriceCents: 0,
        service: { name: "Pack", category: "PACK" },
      },
      {
        quantity: 1,
        totalPriceCents: 10_000,
        service: { name: "Jetski", category: "JETSKI" },
      },
      {
        quantity: 1,
        totalPriceCents: 5_000,
        service: { name: "Banana", category: "TOWABLE" },
      },
    ],
  });

  const map = byService(lines);
  assert.equal(map.get("Jetski")?.salesCents, 10_000);
  assert.equal(map.get("Banana")?.salesCents, 5_000);
  assert.equal(lines.reduce((sum, line) => sum + line.salesCents, 0), 15_000);
});

test("Carritos Jetski+Banana y Banana+Jetski tienen la misma atribucion", () => {
  const common = {
    service: { name: "Padre compat", category: "JETSKI" },
    quantity: 99,
    soldTotalCents: 15_000,
    collectedCents: 12_000,
    pendingCents: 3_000,
  };
  const jetski = {
    quantity: 1,
    totalPriceCents: 10_000,
    service: { name: "Jetski", category: "JETSKI" },
  };
  const banana = {
    quantity: 1,
    totalPriceCents: 5_000,
    service: { name: "Banana", category: "TOWABLE" },
  };

  const first = byService(buildReservationActivityMetricLines({ ...common, items: [jetski, banana] }));
  const second = byService(buildReservationActivityMetricLines({ ...common, items: [banana, jetski] }));

  assert.deepEqual(first.get("Jetski"), second.get("Jetski"));
  assert.deepEqual(first.get("Banana"), second.get("Banana"));
});

test("KPI economico no duplica ingresos por dos items", () => {
  const rows = buildReservationActivityMetricRows([
    {
      service: { name: "Banana padre", category: "TOWABLE" },
      quantity: 1,
      soldTotalCents: 20_000,
      collectedCents: 20_000,
      pendingCents: 0,
      items: [
        {
          quantity: 1,
          totalPriceCents: 12_000,
          service: { name: "Jetski", category: "JETSKI" },
        },
        {
          quantity: 1,
          totalPriceCents: 8_000,
          service: { name: "Banana", category: "TOWABLE" },
        },
      ],
    },
  ]);

  assert.equal(rows.reduce((sum, row) => sum + row.salesCents, 0), 20_000);
  assert.equal(rows.reduce((sum, row) => sum + row.collectedCents, 0), 20_000);
});

test("dos lineas del mismo serviceId cuentan una reserva por servicio", () => {
  const rows = buildReservationActivityMetricRows([
    {
      service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
      quantity: 2,
      soldTotalCents: 30_000,
      collectedCents: 20_000,
      pendingCents: 10_000,
      items: [
        {
          quantity: 1,
          totalPriceCents: 10_000,
          service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        },
        {
          quantity: 1,
          totalPriceCents: 20_000,
          service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        },
      ],
    },
  ]);

  assert.equal(rows[0]?.service, "Jetski");
  assert.equal(rows[0]?.reservations, 1);
  assert.equal(rows[0]?.quantity, 2);
});

test("dos servicios distintos cuentan una reserva en cada servicio", () => {
  const rows = byService(
    buildReservationActivityMetricRows([
      {
        service: { id: "svc-pack", name: "Pack", category: "PACK" },
        quantity: 2,
        soldTotalCents: 20_000,
        collectedCents: 20_000,
        pendingCents: 0,
        items: [
          {
            quantity: 1,
            totalPriceCents: 12_000,
            service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
          },
          {
            quantity: 1,
            totalPriceCents: 8_000,
            service: { id: "svc-banana", name: "Banana", category: "TOWABLE" },
          },
        ],
      },
    ])
  );

  assert.equal(rows.get("Jetski")?.reservations, 1);
  assert.equal(rows.get("Banana")?.reservations, 1);
});

test("tres lineas del mismo servicio siguen contando una reserva y no duplican ingresos", () => {
  const rows = buildReservationActivityMetricRows([
    {
      service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
      quantity: 3,
      soldTotalCents: 60_000,
      collectedCents: 45_000,
      pendingCents: 15_000,
      items: [
        {
          quantity: 1,
          totalPriceCents: 10_000,
          service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        },
        {
          quantity: 1,
          totalPriceCents: 20_000,
          service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        },
        {
          quantity: 1,
          totalPriceCents: 30_000,
          service: { id: "svc-jetski", name: "Jetski", category: "JETSKI" },
        },
      ],
    },
  ]);

  assert.equal(rows[0]?.reservations, 1);
  assert.equal(rows[0]?.salesCents, 60_000);
  assert.equal(rows[0]?.collectedCents, 45_000);
  assert.equal(rows[0]?.pendingCents, 15_000);
  assert.equal(rows.reduce((sum, row) => sum + row.salesCents, 0), 60_000);
});

function assertExactNonNegativeAllocation(total: number, weights: number[]) {
  const allocations = allocateCentsByWeights(total, weights);
  assert.equal(allocations.reduce((sum, value) => sum + value, 0), Math.max(0, Math.round(total)));
  assert.equal(allocations.every((value) => value >= 0), true);
  return allocations;
}

test("reparto de centimos usa largest remainder sin valores negativos", () => {
  assert.deepEqual(assertExactNonNegativeAllocation(1, [1, 1, 1]), [1, 0, 0]);
  assert.deepEqual(assertExactNonNegativeAllocation(2, [1, 1, 1]), [1, 1, 0]);
  assert.deepEqual(assertExactNonNegativeAllocation(100, [1, 2, 3]), [17, 33, 50]);
  assert.deepEqual(assertExactNonNegativeAllocation(0, [1, 2, 3]), [0, 0, 0]);
  assert.deepEqual(assertExactNonNegativeAllocation(5, [0, 0, 0]), [2, 2, 1]);
});

test("reparto de centimos mantiene suma exacta con muchos items", () => {
  const weights = Array.from({ length: 37 }, (_, index) =>
    index % 5 === 0 ? 0 : index % 7 === 0 ? -1 : index + 1
  );
  const allocations = assertExactNonNegativeAllocation(99_999, weights);

  assert.equal(allocations.length, weights.length);
});
