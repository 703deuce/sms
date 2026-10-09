/**
 * Assert Microsoft delta sync window is stable within a UTC day (not per-tick moving).
 * npx tsx scripts/test-microsoft-delta-sync-window.ts
 */
import {
  resolveMicrosoftCalendarViewSyncWindow,
  shouldAdvanceMicrosoftDeltaWindow,
} from "../src/lib/calendar/microsoft-sync-window";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const config = { syncLookbackDays: 7, syncLookaheadDays: 90 };
const noon = new Date("2026-10-09T12:00:00.000Z");
const later = new Date("2026-10-09T18:30:00.000Z");
const w1 = resolveMicrosoftCalendarViewSyncWindow(config, noon);
const w2 = resolveMicrosoftCalendarViewSyncWindow(config, later);
assert(
  w1.timeMin.toISOString() === w2.timeMin.toISOString() &&
    w1.timeMax.toISOString() === w2.timeMax.toISOString(),
  "window must be identical within the same UTC calendar day",
);

const nextDay = new Date("2026-10-10T01:00:00.000Z");
const w3 = resolveMicrosoftCalendarViewSyncWindow(config, nextDay);
assert(
  w3.timeMin.getTime() > w1.timeMin.getTime(),
  "window should advance on UTC day rollover",
);

const farEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
assert(!shouldAdvanceMicrosoftDeltaWindow(farEnd), "should not advance when horizon is far");
const nearEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
assert(shouldAdvanceMicrosoftDeltaWindow(nearEnd), "should advance when within 21 days of window end");

console.log("test-microsoft-delta-sync-window: PASS");
