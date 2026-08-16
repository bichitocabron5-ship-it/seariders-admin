import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlatformIncidentEntity } from "./platform-incident-context";

test("incidente de unidad Jetski se clasifica por recurso Jetski real", () => {
  const entity = resolvePlatformIncidentEntity({
    jetskiId: "jetski-1",
    assetId: "asset-banana",
  });

  assert.deepEqual(entity, {
    entityType: "JETSKI",
    jetskiId: "jetski-1",
    assetId: null,
  });
});

test("incidente de activo nautico se clasifica como ASSET", () => {
  const entity = resolvePlatformIncidentEntity({
    assetId: "asset-banana",
  });

  assert.deepEqual(entity, {
    entityType: "ASSET",
    jetskiId: null,
    assetId: "asset-banana",
  });
});
