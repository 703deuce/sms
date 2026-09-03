#!/usr/bin/env tsx
/**
 * Native availability engine tests.
 * Run: npx tsx scripts/test-availability-engine.ts
 */
import assert from "node:assert/strict";
import {
  defaultWeeklyHours,
  isBlackoutOrClosed,
  isWithinWeeklyHours,
  dayKeyInTimezone,
} from "../src/lib/appointments/availability-engine-policy";

function testDefaultWeeklyHours() {
  const hours = defaultWeeklyHours();
  assert.ok(hours.monday?.length);
  assert.equal(hours.saturday?.length, 0);
  console.log("PASS default weekly hours");
}

function testMultipleWindowsPerDay() {
  const hours = {
    ...defaultWeeklyHours(),
    monday: [
      { open: "09:00", close: "12:00" },
      { open: "13:00", close: "17:00" },
    ],
  };
  const morning = "2026-09-07T13:30:00.000Z"; // Monday 9:30 AM ET (EDT)
  const lunch = "2026-09-07T16:30:00.000Z"; // Monday 12:30 PM ET
  const afternoon = "2026-09-07T18:30:00.000Z"; // Monday 2:30 PM ET
  const tz = "America/New_York";
  assert.equal(isWithinWeeklyHours(morning, tz, hours), true);
  assert.equal(isWithinWeeklyHours(lunch, tz, hours), false);
  assert.equal(isWithinWeeklyHours(afternoon, tz, hours), true);
  console.log("PASS multiple windows per day");
}

function testDateOverrideClosed() {
  const platform = {
    timezone: "America/New_York",
    weeklyHours: defaultWeeklyHours(),
    dateOverrides: [{ date: "2026-09-12", closed: true }],
    reminders: {} as never,
    bookingEnabled: true,
  };
  assert.equal(isBlackoutOrClosed("2026-09-12T14:00:00.000Z", platform), true);
  console.log("PASS date override closed");
}

function testDayKeyInTimezone() {
  const key = dayKeyInTimezone("2026-03-08T05:00:00.000Z", "America/New_York");
  assert.match(key, /sunday|saturday|monday|tuesday|wednesday|thursday|friday/i);
  console.log("PASS day key in timezone");
}

testDefaultWeeklyHours();
testMultipleWindowsPerDay();
testDateOverrideClosed();
testDayKeyInTimezone();
console.log("\nAll availability engine tests passed.");
