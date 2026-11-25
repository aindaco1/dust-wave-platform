import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarMonths, calendarDifference } from "../src/calendar-date.js";

test("date-only month shifts clamp and retain four-digit years", () => {
  assert.equal(addCalendarMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(addCalendarMonths("0099-12-31", 2), "0100-02-28");
  assert.equal(addCalendarMonths("9999-12-31", 0), "9999-12-31");
  assert.throws(() => addCalendarMonths("0001-01-01", -1), RangeError);
  for (const date of ["2023-02-29", "0000-01-01", "2026-13-01", "2026-01-32", "2026-03-08T00:00Z"]) {
    assert.throws(() => addCalendarMonths(date, 0));
  }
});

test("differences count clamped whole months and remaining civil days", () => {
  for (const [start, end, expected] of [
    ["2024-02-29", "2025-02-28", [1, 0, 0]],
    ["2020-02-29", "2024-02-28", [3, 11, 30]],
    ["2026-01-31", "2026-03-01", [0, 1, 1]],
    ["2026-03-07", "2026-03-09", [0, 0, 2]],
    ["2026-03-09", "2026-03-09", [0, 0, 0]]
  ]) {
    const [years, months, days] = expected;
    assert.deepEqual(calendarDifference(start, end), { years, months, days });
  }
  assert.throws(() => calendarDifference("2026-01-02", "2026-01-01"), RangeError);
});
