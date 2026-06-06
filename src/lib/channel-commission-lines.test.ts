import assert from "node:assert/strict";
import test from "node:test";

import { PaymentOrigin } from "@prisma/client";

import { buildChannelCommissionLinePayload } from "./channel-commission-lines";

test("channel commission line payload uses fixed commission snapshot", () => {
  const generatedAt = new Date("2026-06-06T10:00:00.000Z");
  const payload = buildChannelCommissionLinePayload({
    channelId: "channel-1",
    reservationId: "reservation-1",
    sourceOrigin: PaymentOrigin.STORE,
    serviceId: "service-1",
    customerName: "Ada Lovelace",
    commissionBaseCents: 10_000,
    appliedCommissionMode: "FIXED",
    appliedCommissionValue: 15,
    appliedCommissionPct: null,
    appliedCommissionCents: 1_500,
    generatedAt,
  });

  assert.deepEqual(payload, {
    channelId: "channel-1",
    reservationId: "reservation-1",
    paymentId: null,
    sourceOrigin: PaymentOrigin.STORE,
    serviceId: "service-1",
    customerName: "Ada Lovelace",
    commissionBaseCents: 10_000,
    appliedCommissionMode: "FIXED",
    appliedCommissionValue: 15,
    appliedCommissionPct: null,
    commissionCents: 1_500,
    generatedAt,
  });
});

test("channel commission line payload uses percent commission snapshot without recalculating", () => {
  const payload = buildChannelCommissionLinePayload({
    channelId: "channel-1",
    paymentId: "payment-1",
    sourceOrigin: PaymentOrigin.BOOTH,
    serviceId: "service-1",
    commissionBaseCents: 12_345,
    appliedCommissionMode: "PERCENT",
    appliedCommissionValue: 10,
    appliedCommissionPct: 10,
    appliedCommissionCents: 1_234,
  });

  assert.equal(payload?.paymentId, "payment-1");
  assert.equal(payload?.commissionBaseCents, 12_345);
  assert.equal(payload?.commissionCents, 1_234);
  assert.equal(payload?.appliedCommissionPct, 10);
});

test("channel commission line payload is skipped without channel or commission amount", () => {
  assert.equal(
    buildChannelCommissionLinePayload({
      channelId: null,
      sourceOrigin: PaymentOrigin.STORE,
      appliedCommissionCents: 1_000,
    }),
    null
  );
  assert.equal(
    buildChannelCommissionLinePayload({
      channelId: "channel-1",
      sourceOrigin: PaymentOrigin.STORE,
      appliedCommissionCents: 0,
    }),
    null
  );
});
