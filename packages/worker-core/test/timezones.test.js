import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PLATFORM_TIME_ZONE,
  getSupportedTimeZones,
  getTimeZoneOptions,
  isSupportedTimeZone,
  normalizeTimeZone
} from "../src/timezones.js";

test("exposes the Pool and Store timezone contract", () => {
  assert.equal(DEFAULT_PLATFORM_TIME_ZONE, "America/Denver");
  assert.equal(isSupportedTimeZone("America/Denver"), true);
  assert.equal(isSupportedTimeZone("Not/AZone"), false);
  assert.ok(getSupportedTimeZones().includes("UTC"));
  assert.ok(getTimeZoneOptions().some(({ value, label }) => (
    value === "Africa/Addis_Ababa" && label === "Africa/Addis Ababa"
  )));
});

test("normalizes unsupported or blank values to a supported fallback", () => {
  assert.equal(normalizeTimeZone("UTC"), "UTC");
  assert.equal(normalizeTimeZone("Not/AZone", "UTC"), "UTC");
  assert.equal(normalizeTimeZone("", "Not/AZone"), "America/Denver");
});
