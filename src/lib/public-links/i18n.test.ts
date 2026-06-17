import assert from "node:assert/strict";
import test from "node:test";

import {
  appendPublicLanguage,
  getDefaultPublicLanguage,
  getPublicCopy,
  normalizePublicLanguage,
  PUBLIC_LANGUAGE_OPTIONS,
} from "./i18n";

test("public i18n supports french as a public language", () => {
  assert.deepEqual(
    PUBLIC_LANGUAGE_OPTIONS.map((option) => option.value),
    ["es", "en", "fr"]
  );
  assert.equal(normalizePublicLanguage("es"), "es");
  assert.equal(normalizePublicLanguage("en"), "en");
  assert.equal(normalizePublicLanguage("fr"), "fr");
  assert.equal(getDefaultPublicLanguage("FR"), "fr");
  assert.equal(getDefaultPublicLanguage("DE"), "en");
  assert.equal(appendPublicLanguage("/checkin/token", "fr"), "/checkin/token?lang=fr");

  const copy = getPublicCopy("fr");
  assert.equal(copy.common.documentTypeLabel, "Type de document");
  assert.match(
    copy.precheckinModal.buildMessage({
      recipientName: "Claire",
      contractsCount: 2,
      url: "https://example.test/checkin/token?lang=fr",
      expiryLabel: "2 jours",
    }),
    /Bonjour Claire/
  );
});
