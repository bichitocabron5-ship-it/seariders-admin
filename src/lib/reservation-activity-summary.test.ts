import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveReservationActivitySummary,
  sumReservationActivityQuantity,
  sumReservationActivityQuantityForCategory,
  sumReservationJetskiQuantity,
} from "./reservation-activity-summary";

test("resumen de una reserva moderna simple usa la duracion de su linea", () => {
  const summary = resolveReservationActivitySummary({
    service: { name: "Legacy", category: "PACK" },
    option: { durationMinutes: 0 },
    items: [
      {
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 20 },
        isExtra: false,
      },
    ],
  });

  assert.equal(summary.serviceName, "Jetski");
  assert.equal(summary.durationMinutes, 20);
});

test("resumen multi-actividad no inventa una duracion global", () => {
  const summary = resolveReservationActivitySummary({
    service: { name: "Pack padre", category: "PACK" },
    option: { durationMinutes: 90 },
    items: [
      {
        service: { name: "Pack", category: "PACK" },
        option: { durationMinutes: 90 },
        isPackParent: true,
      },
      {
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 20 },
      },
      {
        service: { name: "Banana", category: "TOWABLE" },
        option: { durationMinutes: 15 },
      },
    ],
  });

  assert.equal(summary.serviceName, "Jetski + Banana");
  assert.equal(summary.serviceCategory, "JETSKI + TOWABLE");
  assert.equal(summary.durationMinutes, null);
});

test("resumen legacy sin items usa Reservation.option como fallback", () => {
  const summary = resolveReservationActivitySummary({
    service: { name: "Jetski legacy", category: "JETSKI" },
    option: { durationMinutes: 60 },
    items: [],
  });

  assert.equal(summary.serviceName, "Jetski legacy");
  assert.equal(summary.durationMinutes, 60);
});

test("resumen con solo padre de pack no usa duracion global", () => {
  const summary = resolveReservationActivitySummary({
    service: { name: "Pack padre", category: "PACK" },
    option: { durationMinutes: 90 },
    items: [
      {
        service: { name: "Pack padre", category: "PACK" },
        option: { durationMinutes: 90 },
        isPackParent: true,
      },
    ],
  });

  assert.equal(summary.serviceName, "Pack padre");
  assert.equal(summary.durationMinutes, null);
});

test("carrito Jetski + Banana no depende del servicio padre para cantidad o categoria", () => {
  const reservation = {
    quantity: 99,
    service: { name: "Banana padre", category: "TOWABLE" },
    option: { durationMinutes: 15 },
    items: [
      {
        quantity: 1,
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 20 },
      },
      {
        quantity: 1,
        service: { name: "Banana", category: "TOWABLE" },
        option: { durationMinutes: 15 },
      },
    ],
  };

  const summary = resolveReservationActivitySummary(reservation);

  assert.equal(summary.serviceName, "Jetski + Banana");
  assert.equal(summary.serviceCategory, "JETSKI + TOWABLE");
  assert.equal(summary.durationMinutes, null);
  assert.equal(sumReservationActivityQuantity(reservation), 2);
  assert.equal(sumReservationActivityQuantityForCategory(reservation, "JETSKI"), 1);
  assert.equal(sumReservationActivityQuantityForCategory(reservation, "TOWABLE"), 1);
});

test("carrito Banana + Jetski calcula las mismas cantidades por categoria", () => {
  const reservation = {
    quantity: 99,
    service: { name: "Jetski padre", category: "JETSKI" },
    option: { durationMinutes: 20 },
    items: [
      {
        quantity: 1,
        service: { name: "Banana", category: "TOWABLE" },
        option: { durationMinutes: 15 },
      },
      {
        quantity: 1,
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 20 },
      },
    ],
  };

  assert.equal(sumReservationActivityQuantity(reservation), 2);
  assert.equal(sumReservationActivityQuantityForCategory(reservation, "JETSKI"), 1);
  assert.equal(sumReservationActivityQuantityForCategory(reservation, "TOWABLE"), 1);
});

test("cantidad Jetski explicita solo suma items Jetski en reservas mixtas", () => {
  assert.equal(
    sumReservationJetskiQuantity({
      quantity: 99,
      service: { name: "Padre Jetski", category: "JETSKI" },
      items: [
        { quantity: 1, service: { name: "Jetski", category: "JETSKI" } },
        { quantity: 1, service: { name: "Banana", category: "TOWABLE" } },
      ],
    }),
    1
  );

  assert.equal(
    sumReservationJetskiQuantity({
      quantity: 99,
      service: { name: "Padre Banana", category: "TOWABLE" },
      items: [
        { quantity: 2, service: { name: "Jetski", category: "JETSKI" } },
        { quantity: 4, service: { name: "Banana", category: "TOWABLE" } },
      ],
    }),
    2
  );
});

test("cantidad Jetski explicita devuelve cero sin items Jetski y usa fallback legacy", () => {
  assert.equal(
    sumReservationJetskiQuantity({
      quantity: 4,
      service: { name: "Banana", category: "TOWABLE" },
      items: [{ quantity: 4, service: { name: "Banana", category: "TOWABLE" } }],
    }),
    0
  );

  assert.equal(
    sumReservationJetskiQuantity({
      quantity: 2,
      service: { name: "Jetski legacy", category: "JETSKI" },
      items: [],
    }),
    2
  );
});

test("dos Jetski con duraciones distintas no colapsan a una duracion padre", () => {
  const summary = resolveReservationActivitySummary({
    service: { name: "Jetski padre", category: "JETSKI" },
    option: { durationMinutes: 90 },
    items: [
      {
        quantity: 1,
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 20 },
      },
      {
        quantity: 1,
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 40 },
      },
    ],
  });

  assert.equal(summary.serviceName, "Jetski");
  assert.equal(summary.serviceCategory, "JETSKI");
  assert.equal(summary.durationMinutes, null);
});
