import assert from "node:assert/strict";
import test from "node:test";

import { normalizePhoneForWhatsApp } from "./phone-normalization";

test("normalizePhoneForWhatsApp uses the selected country dial code for local numbers", () => {
  assert.equal(normalizePhoneForWhatsApp("06 12 34 56 78", "FR"), "33612345678");
  assert.equal(normalizePhoneForWhatsApp("612345678", "ES"), "34612345678");
});

test("normalizePhoneForWhatsApp keeps explicit international prefixes", () => {
  assert.equal(normalizePhoneForWhatsApp("+49 1512 3456789", "ES"), "4915123456789");
  assert.equal(normalizePhoneForWhatsApp("0039 312 345 6789", "ES"), "393123456789");
});
