import test from "node:test";
import assert from "node:assert/strict";

import {
  GENERIC_COMMIT_CANCEL_ERROR,
  validateGenericCommercialAdjustmentCommitOperation,
} from "./commercial-adjustment-endpoints";

test("commercial-adjustment commit generico rechaza CANCEL", () => {
  const result = validateGenericCommercialAdjustmentCommitOperation("CANCEL");

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.error, GENERIC_COMMIT_CANCEL_ERROR);
  assert.match(result.error, /\/api\/store\/reservations\/\[id\]\/cancel/);
});

test("commercial-adjustment commit generico acepta solo EDIT", () => {
  assert.deepEqual(validateGenericCommercialAdjustmentCommitOperation("EDIT"), { ok: true });
});
