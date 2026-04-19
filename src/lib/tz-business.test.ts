import test from "node:test";
import assert from "node:assert/strict";

import { getDateTimePartsInTz, tzLocalToUtcDate } from "./tz-business";

test("getDateTimePartsInTz resolves Madrid local day and time from UTC date", () => {
  const utcDate = tzLocalToUtcDate("Europe/Madrid", 2026, 8, 15, 11, 30);
  const parts = getDateTimePartsInTz(utcDate, "Europe/Madrid");

  assert.equal(parts.ymd, "2026-08-15");
  assert.equal(parts.hour, 11);
  assert.equal(parts.minute, 30);
  assert.equal(parts.dow1to7, 6);
});
