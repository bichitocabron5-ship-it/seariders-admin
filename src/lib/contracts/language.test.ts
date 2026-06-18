import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStoredContractLanguage,
  resolveContractRenderLanguage,
} from "./language";

test("contract render language follows requested language while signedLanguage is null", () => {
  assert.equal(
    resolveContractRenderLanguage({
      requestedLanguage: "en",
      signedLanguage: null,
    }),
    "en"
  );
});

test("contract render language uses persisted signedLanguage over requested language", () => {
  assert.equal(
    resolveContractRenderLanguage({
      requestedLanguage: "en",
      signedLanguage: "fr",
    }),
    "fr"
  );
});

test("stored contract language parsing is strict but tolerant of casing", () => {
  assert.equal(parseStoredContractLanguage(" EN "), "en");
  assert.equal(parseStoredContractLanguage("de"), null);
  assert.equal(parseStoredContractLanguage(null), null);
});
