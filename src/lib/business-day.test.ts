import test from "node:test";
import assert from "node:assert/strict";

import { getBusinessDate, getBusinessDayRange } from "./business-day";

test("getBusinessDayRange resolves a normal Europe/Madrid business day", () => {
  const range = getBusinessDayRange("2026-05-12", "Europe/Madrid");

  assert.equal(range.date, "2026-05-12");
  assert.equal(range.start.toISOString(), "2026-05-11T22:00:00.000Z");
  assert.equal(range.endExclusive.toISOString(), "2026-05-12T22:00:00.000Z");
});

test("getBusinessDayRange handles month boundaries", () => {
  const range = getBusinessDayRange("2026-01-31", "Europe/Madrid");

  assert.equal(range.date, "2026-01-31");
  assert.equal(range.start.toISOString(), "2026-01-30T23:00:00.000Z");
  assert.equal(range.endExclusive.toISOString(), "2026-01-31T23:00:00.000Z");
});

test("getBusinessDate uses Europe/Madrid instead of UTC calendar day", () => {
  const input = new Date("2026-08-14T22:30:00.000Z");

  assert.equal(getBusinessDate(input, "Europe/Madrid"), "2026-08-15");
});

test("getBusinessDayRange accepts explicit YYYY-MM-DD input", () => {
  const range = getBusinessDayRange("2026-03-01", "Europe/Madrid");

  assert.equal(range.date, "2026-03-01");
  assert.equal(range.start.toISOString(), "2026-02-28T23:00:00.000Z");
  assert.equal(range.endExclusive.toISOString(), "2026-03-01T23:00:00.000Z");
});
