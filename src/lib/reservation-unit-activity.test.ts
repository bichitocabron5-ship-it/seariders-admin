import assert from "node:assert/strict";
import test from "node:test";

import { resolveReservationUnitActivity } from "./reservation-unit-activity";

test("actividad moderna se resuelve desde ReservationUnit aunque la reserva padre sea Banana", () => {
  const activity = resolveReservationUnitActivity({
    unit: {
      reservationItemId: "item-jetski",
      serviceId: "svc-jetski",
      optionId: "opt-jetski-20",
      serviceName: "Jetski",
      serviceCategory: "JETSKI",
      durationMinutesSnapshot: 20,
      quantitySnapshot: 1,
      paxSnapshot: 2,
    },
    legacyReservation: {
      quantity: 1,
      pax: 4,
      service: { id: "svc-banana", name: "Banana", category: "PACK" },
      option: { id: "opt-banana-15", durationMinutes: 15 },
    },
  });

  assert.equal(activity.source, "UNIT");
  assert.equal(activity.serviceCategory, "JETSKI");
  assert.equal(activity.durationMinutes, 20);
  assert.equal(activity.quantity, 1);
});

test("actividad legacy usa Reservation.service/option solo sin snapshot de unidad", () => {
  const activity = resolveReservationUnitActivity({
    unit: null,
    legacyReservation: {
      quantity: 1,
      pax: 4,
      service: { id: "svc-banana", name: "Banana", category: "NAUTICA" },
      option: { id: "opt-banana-15", durationMinutes: 15 },
    },
  });

  assert.deepEqual(activity, {
    serviceId: "svc-banana",
    optionId: "opt-banana-15",
    serviceName: "Banana",
    serviceCategory: "NAUTICA",
    durationMinutes: 15,
    quantity: 1,
    pax: 4,
    source: "LEGACY",
  });
});
