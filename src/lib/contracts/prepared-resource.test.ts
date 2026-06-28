import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPreparedBoatAssets,
  preparedResourcePatchForSelector,
  resolvePreparedResourceSelector,
} from "./prepared-resource";

test("JETSKI_LICENSED usa solo selector de jetski preparado", () => {
  assert.equal(
    resolvePreparedResourceSelector({
      templateCode: "JETSKI_LICENSED",
      isLicense: true,
      serviceCategory: "BOAT",
    }),
    "jetski"
  );
});

test("BOAT_LICENSED usa solo selector de asset preparado", () => {
  assert.equal(
    resolvePreparedResourceSelector({
      templateCode: "BOAT_LICENSED",
      isLicense: true,
      serviceCategory: "JETSKI",
    }),
    "asset"
  );
});

test("contratos en borrador sin template usan la categoria como fallback", () => {
  assert.equal(
    resolvePreparedResourceSelector({
      templateCode: null,
      isLicense: true,
      serviceCategory: "BOAT",
    }),
    "asset"
  );
});

test("assets preparados de barco excluyen tipos no BOAT", () => {
  const assets = filterPreparedBoatAssets([
    { id: "boat-1", type: "BOAT" },
    { id: "towable-1", type: "TOWABLE" },
    { id: "other-1", type: "OTHER" },
    { id: "towboat-1", type: "TOWBOAT" },
  ]);

  assert.deepEqual(
    assets.map((asset) => asset.id),
    ["boat-1"]
  );
});

test("payload de BOAT_LICENSED limpia preparedJetski y guarda solo preparedAsset", () => {
  assert.deepEqual(
    preparedResourcePatchForSelector({
      selectorKind: "asset",
      preparedJetskiId: "jetski-legacy",
      preparedAssetId: "boat-1",
    }),
    {
      preparedJetskiId: null,
      preparedAssetId: "boat-1",
    }
  );
});
