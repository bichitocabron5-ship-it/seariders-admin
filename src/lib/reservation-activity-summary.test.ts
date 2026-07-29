import assert from "node:assert/strict";
import test from "node:test";

import { resolveReservationActivitySummary } from "./reservation-activity-summary";

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
