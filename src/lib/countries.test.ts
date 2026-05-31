import assert from "node:assert/strict";
import test from "node:test";

import {
  getCountryDialCodeOptions,
  getCountryFlagEmoji,
  getCountryOptionsEs,
} from "./countries";

test("phone country options put frequent countries first", () => {
  const options = getCountryDialCodeOptions(getCountryOptionsEs());

  assert.deepEqual(
    options.slice(0, 7).map((option) => `${option.value}+${option.dialCode}`),
    ["ES+34", "FR+33", "DE+49", "IT+39", "GB+44", "NL+31", "BE+32"]
  );
});

test("phone country search text includes spanish, english, iso and dial code", () => {
  const options = getCountryDialCodeOptions(getCountryOptionsEs());
  const france = options.find((option) => option.value === "FR");

  assert.ok(france);
  assert.ok(france.searchText.includes("francia"));
  assert.ok(france.searchText.includes("france"));
  assert.ok(france.searchText.includes("fr"));
  assert.ok(france.searchText.includes("33"));
  assert.ok(france.searchText.includes("+33"));
});

test("phone country options keep countries with repeated dial codes", () => {
  const options = getCountryDialCodeOptions(getCountryOptionsEs());
  const plus44Countries = options
    .filter((option) => option.dialCode === "44")
    .map((option) => option.value);

  assert.ok(plus44Countries.includes("GB"));
  assert.ok(plus44Countries.includes("GG"));
  assert.ok(plus44Countries.includes("IM"));
  assert.ok(plus44Countries.includes("JE"));
});

test("country flag emoji is generated from ISO alpha-2", () => {
  assert.equal(getCountryFlagEmoji("ES"), String.fromCodePoint(0x1f1ea, 0x1f1f8));
  assert.equal(getCountryFlagEmoji(""), "");
});
