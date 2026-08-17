import assert from "node:assert/strict";
import test from "node:test";

import { ReservationStatus } from "@prisma/client";

import { evaluateReadyForPlatform } from "./ready-for-platform";

function baseReadyReservation() {
  return {
    status: ReservationStatus.SCHEDULED,
    formalizedAt: new Date("2026-07-27T09:00:00.000Z"),
    totalPriceCents: 0,
    depositCents: 0,
    quantity: 2,
    serviceId: null,
    optionId: null,
    pax: 2,
    isLicense: false,
    service: { name: "Pack", category: "PACK" },
    option: { durationMinutes: 0 },
    items: [
      {
        id: "item-jetski-20",
        serviceId: "svc-jetski",
        optionId: "opt-jetski-20",
        quantity: 1,
        pax: 2,
        isExtra: false,
        totalPriceCents: 0,
        service: { name: "Jetski 20", category: "JETSKI" },
        option: { durationMinutes: 20 },
      },
      {
        id: "item-jetski-40",
        serviceId: "svc-jetski",
        optionId: "opt-jetski-40",
        quantity: 1,
        pax: 2,
        isExtra: false,
        totalPriceCents: 0,
        service: { name: "Jetski 40", category: "JETSKI" },
        option: { durationMinutes: 40 },
      },
    ],
    contracts: [],
    payments: [],
  };
}

test("ready-for-platform exige contratos de todas las lineas modernas", () => {
  const missingSecond = evaluateReadyForPlatform({
    ...baseReadyReservation(),
    contracts: [
      {
        reservationItemId: "item-jetski-20",
        logicalUnitIndex: 1,
        unitIndex: 1,
        status: "READY",
      },
    ],
  });

  assert.equal(missingSecond.ok, false);
  assert.equal(missingSecond.requiredUnits, 2);
  assert.equal(missingSecond.readyCount, 1);

  const complete = evaluateReadyForPlatform({
    ...baseReadyReservation(),
    contracts: [
      {
        reservationItemId: "item-jetski-20",
        logicalUnitIndex: 1,
        unitIndex: 1,
        status: "READY",
      },
      {
        reservationItemId: "item-jetski-40",
        logicalUnitIndex: 2,
        unitIndex: 2,
        status: "READY",
      },
    ],
  });

  assert.equal(complete.ok, true);
  assert.equal(complete.requiredUnits, 2);
  assert.equal(complete.readyCount, 2);
});
