import test from "node:test";
import assert from "node:assert/strict";

import { resolveReservationPaymentStatus } from "./reservation-payment-status";

test("resolveReservationPaymentStatus marks fully paid reservations as PAID", () => {
  const status = resolveReservationPaymentStatus({
    totalPriceCents: 15_000,
    depositCents: 5_000,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    payments: [
      { amountCents: 15_000, isDeposit: false, direction: "IN", method: "CARD" },
      { amountCents: 5_000, isDeposit: true, direction: "IN", method: "CARD" },
    ],
  });

  assert.equal(status.state, "PAID");
  assert.equal(status.displayPendingCents, 0);
});

test("resolveReservationPaymentStatus marks partially paid reservations as PARTIAL", () => {
  const status = resolveReservationPaymentStatus({
    totalPriceCents: 15_000,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    payments: [{ amountCents: 5_000, isDeposit: false, direction: "IN", method: "CASH" }],
  });

  assert.equal(status.state, "PARTIAL");
  assert.equal(status.displayPendingServiceCents, 10_000);
});

test("resolveReservationPaymentStatus respects discounted totals already stored on the reservation", () => {
  const status = resolveReservationPaymentStatus({
    totalPriceCents: 8_000,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    payments: [{ amountCents: 8_000, isDeposit: false, direction: "IN", method: "TRANSFER" }],
  });

  assert.equal(status.state, "PAID");
  assert.equal(status.serviceDueCents, 8_000);
});

test("resolveReservationPaymentStatus marks canceled reservations as CANCELED for display", () => {
  const status = resolveReservationPaymentStatus({
    reservationStatus: "CANCELED",
    totalPriceCents: 15_000,
    depositCents: 5_000,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    payments: [],
  });

  assert.equal(status.state, "CANCELED");
  assert.equal(status.displayPendingCents, 0);
});

test("resolveReservationPaymentStatus marks refunded service reservations as REFUNDED", () => {
  const status = resolveReservationPaymentStatus({
    totalPriceCents: 15_000,
    depositCents: 0,
    quantity: 1,
    isLicense: false,
    serviceCategory: "JETSKI",
    payments: [
      { amountCents: 15_000, isDeposit: false, direction: "IN", method: "CARD" },
      { amountCents: 15_000, isDeposit: false, direction: "OUT", method: "CARD" },
    ],
  });

  assert.equal(status.state, "REFUNDED");
  assert.equal(status.paidServiceCents, 0);
});
