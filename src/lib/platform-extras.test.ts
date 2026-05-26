import assert from "node:assert/strict";
import test from "node:test";

import { parsePlatformExtraService } from "./platform-extras";

test("catálogo platform detecta extra jetski +20", () => {
  const result = parsePlatformExtraService({
    id: "svc-20",
    code: "EXTRA-JETSKI-20",
    name: "Extra JetSki +20",
  });

  assert.deepEqual(result, {
    serviceId: "svc-20",
    serviceCode: "EXTRA-JETSKI-20",
    serviceName: "Extra JetSki +20",
    extraMinutes: 20,
    target: "JETSKI",
  });
});

test("catálogo platform detecta extra boat +40", () => {
  const result = parsePlatformExtraService({
    id: "svc-40",
    code: "NAUTICA-PLUS-40",
    name: "Barco +40 min",
  });

  assert.deepEqual(result, {
    serviceId: "svc-40",
    serviceCode: "NAUTICA-PLUS-40",
    serviceName: "Barco +40 min",
    extraMinutes: 40,
    target: "BOAT",
  });
});
