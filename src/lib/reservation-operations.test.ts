import assert from "node:assert/strict";
import test from "node:test";

import {
  getOperationalBlockLabel,
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "./reservation-operations";
import { computeRequiredPlatformUnits } from "./reservation-rules";

test("towable quantity=1 keeps base operational duration", () => {
  assert.equal(
    getOperationalDurationMinutes({
      category: "TOWABLE",
      durationMinutes: 15,
      quantity: 1,
    }),
    15
  );
});

test("towable quantity=2 doubles operational duration", () => {
  assert.equal(
    getOperationalDurationMinutes({
      category: "TOWABLE",
      durationMinutes: 15,
      quantity: 2,
    }),
    30
  );
});

test("towable quantity=5 expands operational block to 75 minutes", () => {
  assert.equal(
    getOperationalDurationMinutes({
      category: "TOWABLE",
      durationMinutes: 15,
      quantity: 5,
    }),
    75
  );
});

test("towable capacity stays as one operational resource", () => {
  assert.equal(
    getOperationalCapacityUnits({
      category: "TOWABLE",
      quantity: 5,
    }),
    1
  );
});

test("towable platform queue stays grouped as one unit", () => {
  assert.equal(
    computeRequiredPlatformUnits({
      quantity: 5,
      serviceCategory: "TOWABLE",
      items: [],
    }),
    1
  );
});

test("jetski keeps one platform unit per quantity", () => {
  assert.equal(
    computeRequiredPlatformUnits({
      quantity: 3,
      serviceCategory: "JETSKI",
      items: [],
    }),
    3
  );
});

test("operational block label shows grouped summary", () => {
  assert.equal(
    getOperationalBlockLabel({
      serviceName: "Banana",
      quantity: 5,
      pax: 40,
      durationMinutes: 15,
      category: "TOWABLE",
    }),
    "Banana x5 · 40 pax · 75 min"
  );
});
