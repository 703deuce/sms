/**
 * Runtime business-local clock for call-start dynvars.
 * Run: npx tsx scripts/test-runtime-clock.ts
 */
import assert from "node:assert/strict";
import {
  buildBusinessLocalClock,
  normalizeUtcOffset,
} from "../src/lib/voice/runtime-clock";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

section("normalizeUtcOffset");
assert.equal(normalizeUtcOffset("GMT-4"), "-04:00");
assert.equal(normalizeUtcOffset("UTC+5:30"), "+05:30");
assert.equal(normalizeUtcOffset("-07"), "-07:00");
assert.equal(normalizeUtcOffset("UTC"), "+00:00");

section("America/New_York mid-afternoon");
{
  // 2026-08-05 18:15 UTC = 14:15 EDT (UTC-4)
  const now = new Date("2026-08-05T18:15:00.000Z");
  const clock = buildBusinessLocalClock("America/New_York", now);
  assert.equal(clock.business_timezone, "America/New_York");
  assert.equal(clock.current_date, "2026-08-05");
  assert.equal(clock.current_day, "Wednesday");
  assert.match(clock.current_time, /^2:15 PM$/i);
  assert.equal(clock.utc_offset, "-04:00");
  assert.ok(clock.current_iso_local.startsWith("2026-08-05T14:15:00"));
}

section("America/Los_Angeles morning");
{
  const now = new Date("2026-08-05T18:15:00.000Z");
  const clock = buildBusinessLocalClock("America/Los_Angeles", now);
  assert.equal(clock.current_date, "2026-08-05");
  assert.equal(clock.current_day, "Wednesday");
  assert.match(clock.current_time, /^11:15 AM$/i);
  assert.equal(clock.utc_offset, "-07:00");
}

section("Invalid timezone falls back to America/New_York");
{
  const clock = buildBusinessLocalClock("Not/AZone", new Date("2026-08-05T18:15:00.000Z"));
  assert.equal(clock.business_timezone, "America/New_York");
  assert.equal(clock.current_date, "2026-08-05");
  assert.equal(clock.current_day, "Wednesday");
}

console.log("\nAll runtime-clock checks passed.");
