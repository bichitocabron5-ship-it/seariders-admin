import test from "node:test";
import assert from "node:assert/strict";

import { computeReservationDepositCents, deriveReservationDepositStatus } from "./reservation-deposits";

test("computeReservationDepositCents keeps explicit zero deposit without legacy fallback", () => {
  const depositCents = computeReservationDepositCents({
    storedDepositCents: 0,
    quantity: 2,
    isLicense: false,
    serviceCategory: "JETSKI",
    items: [],
  });

  assert.equal(depositCents, 0);
});

test("computeReservationDepositCents still supports legacy fallback when deposit is missing", () => {
  const depositCents = computeReservationDepositCents({
    storedDepositCents: null,
    quantity: 2,
    isLicense: false,
    serviceCategory: "JETSKI",
    items: [],
  });

  assert.equal(depositCents, 20_000);
});

test("deriveReservationDepositStatus returns NO_APLICA when reservation has no real deposit", () => {
  const status = deriveReservationDepositStatus({
    depositCents: 0,
    depositHeld: false,
    payments: [],
  });

  assert.equal(status, "NO_APLICA");
});

test("deriveReservationDepositStatus keeps LIBERABLE when deposit was actually collected", () => {
  const status = deriveReservationDepositStatus({
    depositCents: 0,
    depositHeld: false,
    payments: [{ amountCents: 10_000, isDeposit: true, direction: "IN" }],
  });

  assert.equal(status, "LIBERABLE");
});
