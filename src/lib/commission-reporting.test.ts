import assert from "node:assert/strict";
import test from "node:test";

import { commissionFromBase, proportionalCommissionBaseForCollected } from "@/lib/commission";
import { resolveCommissionForReporting } from "@/lib/commission-reporting";

test("resolveCommissionForReporting keeps persisted percentage snapshot", () => {
  const result = resolveCommissionForReporting({
    commissionBaseCents: 10_000,
    appliedCommissionMode: "PERCENT",
    appliedCommissionValue: 12.5,
    appliedCommissionPct: 12.5,
    appliedCommissionCents: 1_250,
    legacyBaseCents: 9_999,
  });

  assert.deepEqual(result, {
    commissionBaseCents: 10_000,
    appliedCommissionMode: "PERCENT",
    appliedCommissionValue: 12.5,
    appliedCommissionPct: 12.5,
    appliedCommissionCents: 1_250,
    source: "SNAPSHOT",
  });
});

test("resolveCommissionForReporting keeps persisted fixed snapshot", () => {
  const result = resolveCommissionForReporting({
    commissionBaseCents: 8_000,
    appliedCommissionMode: "FIXED",
    appliedCommissionValue: 9.75,
    appliedCommissionPct: null,
    appliedCommissionCents: 975,
    legacyBaseCents: 12_000,
  });

  assert.deepEqual(result, {
    commissionBaseCents: 8_000,
    appliedCommissionMode: "FIXED",
    appliedCommissionValue: 9.75,
    appliedCommissionPct: null,
    appliedCommissionCents: 975,
    source: "SNAPSHOT",
  });
});

test("resolveCommissionForReporting recalculates legacy rows when snapshot is incomplete", () => {
  const result = resolveCommissionForReporting({
    commissionBaseCents: 0,
    appliedCommissionMode: "PERCENT",
    appliedCommissionValue: 0,
    appliedCommissionPct: null,
    appliedCommissionCents: 0,
    legacyBaseCents: 15_000,
    serviceId: "svc-1",
    channel: {
      kind: "STANDARD",
      commissionEnabled: true,
      commissionPct: 15,
    },
  });

  assert.deepEqual(result, {
    commissionBaseCents: 15_000,
    appliedCommissionMode: "PERCENT",
    appliedCommissionValue: 15,
    appliedCommissionPct: 15,
    appliedCommissionCents: 2_250,
    source: "LEGACY_RECALCULATED",
  });
});

test("full collection closure commission matches history commission for the same reservation", () => {
  const history = resolveCommissionForReporting({
    commissionBaseCents: 12_000,
    appliedCommissionMode: "PERCENT",
    appliedCommissionValue: 10,
    appliedCommissionPct: 10,
    appliedCommissionCents: 1_200,
  });

  const collectedBase = proportionalCommissionBaseForCollected({
    collectedNetCents: 12_000,
    reservationNetCents: 12_000,
    reservationCommissionBaseCents: history.commissionBaseCents,
  });
  const closure = commissionFromBase(collectedBase, Number(history.appliedCommissionPct ?? 0) / 100);

  assert.equal(closure, history.appliedCommissionCents);
});
