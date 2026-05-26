import assert from "node:assert/strict";
import test from "node:test";

import { buildStoredPhoneNumber, resolvePhoneFieldState } from "./phone-country";

test("buildStoredPhoneNumber stores the dial code separately from customer country data", () => {
  assert.equal(buildStoredPhoneNumber("612345678", "ES"), "+34612345678");
  assert.equal(buildStoredPhoneNumber("06 12 34 56 78", "FR"), "+33612345678");
});

test("resolvePhoneFieldState recovers dial country and local number from an international phone", () => {
  const result = resolvePhoneFieldState("+33612345678", "ES");

  assert.equal(result.dialCountry, "FR");
  assert.equal(result.localPhone, "612345678");
});

test("resolvePhoneFieldState keeps fallback country when the stored phone is local", () => {
  const result = resolvePhoneFieldState("612345678", "ES");

  assert.equal(result.dialCountry, "ES");
  assert.equal(result.localPhone, "612345678");
});
