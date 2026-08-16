import assert from "node:assert/strict";
import test from "node:test";

import { AssetType } from "@prisma/client";

import { isAssetCompatibleWithServiceCategory } from "./platform-resource-compat";

test("asset compatibility usa la categoria operativa recibida desde la unidad", () => {
  assert.equal(
    isAssetCompatibleWithServiceCategory({
      assetType: AssetType.TOWABLE,
      serviceCategory: "TOWABLE",
    }),
    true
  );

  assert.equal(
    isAssetCompatibleWithServiceCategory({
      assetType: AssetType.JETCAR,
      serviceCategory: "TOWABLE",
    }),
    false
  );
});
