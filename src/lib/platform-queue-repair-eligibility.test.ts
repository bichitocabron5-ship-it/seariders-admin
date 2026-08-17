import assert from "node:assert/strict";
import test from "node:test";

import { isReservationEligibleForPlatformQueueRepairScope } from "./platform-queue-repair-eligibility";

test("legacy READY sin items y unidad sin serviceCategory usa padre JETSKI en scope JETSKI", () => {
  assert.equal(
    isReservationEligibleForPlatformQueueRepairScope(
      {
        service: { category: "JETSKI" },
        items: [],
        units: [{ status: "READY_FOR_PLATFORM", serviceCategory: null }],
      },
      { kind: "JETSKI", categories: null }
    ),
    true
  );
});

test("legacy READY sin items y unidad sin serviceCategory no entra en JETSKI si padre es TOWABLE", () => {
  assert.equal(
    isReservationEligibleForPlatformQueueRepairScope(
      {
        service: { category: "TOWABLE" },
        items: [],
        units: [{ status: "READY_FOR_PLATFORM", serviceCategory: null }],
      },
      { kind: "JETSKI", categories: null }
    ),
    false
  );
});

test("unidad moderna incompatible bloquea fallback padre compatible", () => {
  assert.equal(
    isReservationEligibleForPlatformQueueRepairScope(
      {
        service: { category: "JETSKI" },
        items: [],
        units: [{ status: "READY_FOR_PLATFORM", serviceCategory: "TOWABLE" }],
      },
      { kind: "JETSKI", categories: null }
    ),
    false
  );
});

test("reserva moderna con items usa items y no fallback padre", () => {
  assert.equal(
    isReservationEligibleForPlatformQueueRepairScope(
      {
        service: { category: "JETSKI" },
        items: [
          {
            isExtra: false,
            isPackParent: false,
            service: { category: "TOWABLE" },
          },
        ],
        units: [{ status: "READY_FOR_PLATFORM", serviceCategory: null }],
      },
      { kind: "JETSKI", categories: null }
    ),
    false
  );
});

test("unidad legacy cancelada no bloquea fallback padre", () => {
  assert.equal(
    isReservationEligibleForPlatformQueueRepairScope(
      {
        service: { category: "JETSKI" },
        items: [],
        units: [{ status: "CANCELED", serviceCategory: "TOWABLE" }],
      },
      { kind: "JETSKI", categories: null }
    ),
    true
  );
});
