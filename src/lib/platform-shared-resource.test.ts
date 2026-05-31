import assert from "node:assert/strict";
import test from "node:test";

import { canShareMonitorAssetWithReservation } from "./platform-shared-resource";

test("boat/jetcar sin licencia pueden compartir recurso con salida con monitor", () => {
  assert.equal(
    canShareMonitorAssetWithReservation({
      runKind: "NAUTICA",
      runMode: "MONITOR",
      serviceCategory: "BOAT",
      isLicense: false,
    }),
    true
  );
});

test("boat con licencia puede usar recurso base en salida sin monitor", () => {
  assert.equal(
    canShareMonitorAssetWithReservation({
      runKind: "NAUTICA",
      runMode: "SOLO",
      serviceCategory: "BOAT",
      isLicense: true,
    }),
    true
  );
});

test("boat con licencia no comparte recurso con salida con monitor", () => {
  assert.equal(
    canShareMonitorAssetWithReservation({
      runKind: "NAUTICA",
      runMode: "MONITOR",
      serviceCategory: "BOAT",
      isLicense: true,
    }),
    false
  );
});

test("categorias no nauticas no comparten recurso base", () => {
  assert.equal(
    canShareMonitorAssetWithReservation({
      runKind: "JETSKI",
      runMode: "SOLO",
      serviceCategory: "JETSKI",
      isLicense: true,
    }),
    false
  );
});
