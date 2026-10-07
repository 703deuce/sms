import assert from "node:assert/strict";
import {
  arSmsUsagePeriodUtcBounds,
  currentArSmsUsagePeriodKey,
} from "@/lib/appointment-reminders/ar-sms-usage-constants";

const key = currentArSmsUsagePeriodKey(new Date("2026-10-15T12:00:00Z"));
assert.equal(key, "2026-10");

const bounds = arSmsUsagePeriodUtcBounds("2026-10");
assert.equal(bounds.start.toISOString(), "2026-10-01T00:00:00.000Z");
assert.equal(bounds.end.toISOString(), "2026-11-01T00:00:00.000Z");

console.log("ar-sms-usage-constants.test.ts: PASS");
