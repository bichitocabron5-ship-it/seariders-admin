import assert from "node:assert/strict";
import test from "node:test";

import {
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
