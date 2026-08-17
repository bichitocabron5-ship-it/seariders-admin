import assert from "node:assert/strict";
import test from "node:test";

import { ReservationStatus, ReservationUnitStatus } from "@prisma/client";

import {
  deriveReservationStatusFromUnits,
  hasPendingOperationalUnits,
} from "./reservation-status";

test("estado operativo agregado contempla todas las unidades", () => {
  assert.equal(
    deriveReservationStatusFromUnits([
      { status: ReservationUnitStatus.COMPLETED },
      { status: ReservationUnitStatus.WAITING },
    ]),
    ReservationStatus.WAITING
  );
  assert.equal(
    deriveReservationStatusFromUnits([
      { status: ReservationUnitStatus.COMPLETED },
      { status: ReservationUnitStatus.IN_SEA },
    ]),
    ReservationStatus.IN_SEA
  );
  assert.equal(
    deriveReservationStatusFromUnits([
      { status: ReservationUnitStatus.COMPLETED },
      { status: ReservationUnitStatus.COMPLETED },
    ]),
    ReservationStatus.COMPLETED
  );
});

test("completion bloquea cierre si queda alguna unidad pendiente", () => {
  assert.equal(
    hasPendingOperationalUnits([
      { status: ReservationUnitStatus.COMPLETED },
      { status: ReservationUnitStatus.READY_FOR_PLATFORM },
    ]),
    true
  );
  assert.equal(
    hasPendingOperationalUnits([
      { status: ReservationUnitStatus.COMPLETED },
      { status: ReservationUnitStatus.CANCELED },
    ]),
    false
  );
});
