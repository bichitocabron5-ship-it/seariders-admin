import assert from "node:assert/strict";
import test from "node:test";

import { resolveContractNotificationRecipient } from "./reservation-parties";

test("contract notifications prefer reservation holder phone over contract phone", () => {
  const recipient = resolveContractNotificationRecipient({
    contract: {
      driverName: "Conductor secundario",
      driverPhone: "+33123456789",
      driverCountry: "FR",
    },
    reservation: {
      customerName: "Titular reserva",
      customerPhone: "+34612345678",
      customerCountry: "ES",
    },
  });

  assert.equal(recipient.recipientName, "Conductor secundario");
  assert.equal(recipient.phone, "+34612345678");
  assert.equal(recipient.country, "ES");
  assert.equal(recipient.source, "RESERVATION");
});
