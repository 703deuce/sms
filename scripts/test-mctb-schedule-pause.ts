/**
 * MCTB schedule pause semantics — manual pause must stick; timed pause must expire.
 *
 * Run: npx tsx scripts/test-mctb-schedule-pause.ts
 */
import assert from "node:assert/strict";
import {
  buildMctbPauseMutation,
  isMctbSchedulePaused,
  isPauseUntilActive,
  normalizeMctbPauseState,
  resolveMctbPauseKind,
  type MctbScheduleSettings,
} from "../src/lib/mctb/schedule";

const now = new Date("2026-08-26T12:00:00.000Z");
const futurePause = new Date("2026-08-26T18:00:00.000Z").toISOString();
const pastPause = new Date("2026-08-26T08:00:00.000Z").toISOString();

const base: MctbScheduleSettings = {
  scheduleMode: "always_on",
  weeklySchedule: null,
  pauseUntil: null,
  manuallyPaused: false,
};

assert.equal(
  buildMctbPauseMutation({ enabled: false })?.manuallyPaused,
  true,
  "manual pause sets manuallyPaused",
);
assert.equal(
  buildMctbPauseMutation({ enabled: false })?.enabled,
  false,
  "manual pause disables runtime enabled flag",
);
assert.equal(
  buildMctbPauseMutation({ enabled: true })?.manuallyPaused,
  false,
  "resume clears manuallyPaused",
);

const timed = buildMctbPauseMutation({ pauseUntil: futurePause, now });
assert.equal(timed?.manuallyPaused, false, "timed pause is not manual");
assert.equal(timed?.enabled, true, "timed pause keeps enabled true");
assert.equal(timed?.pauseUntil, futurePause, "timed pause stores pauseUntil");

assert.equal(
  isMctbSchedulePaused(
    { ...base, manuallyPaused: true },
    { enabled: true },
    now,
  ),
  true,
  "sticky manual pause survives enabled=true overwrite",
);

assert.equal(
  isMctbSchedulePaused(base, { enabled: false }, now),
  true,
  "legacy enabled=false still pauses",
);

assert.equal(
  isMctbSchedulePaused(
    { ...base, pauseUntil: futurePause },
    { enabled: true },
    now,
  ),
  true,
  "active timed pause suppresses automation",
);

assert.equal(
  isMctbSchedulePaused(
    { ...base, pauseUntil: pastPause },
    { enabled: true },
    now,
  ),
  false,
  "expired timed pause does not suppress automation",
);

assert.equal(isPauseUntilActive(pastPause, now), false, "past pauseUntil inactive");
assert.equal(isPauseUntilActive(futurePause, now), true, "future pauseUntil active");

const normalizedExpired = normalizeMctbPauseState(
  { ...base, pauseUntil: pastPause },
  { enabled: true },
  now,
);
assert.equal(normalizedExpired.settings.pauseUntil, null, "normalize clears expired pauseUntil");
assert.equal(normalizedExpired.changed, true, "normalize marks expired cleanup");

const normalizedLegacyManual = normalizeMctbPauseState(base, { enabled: false }, now);
assert.equal(
  normalizedLegacyManual.settings.manuallyPaused,
  true,
  "normalize migrates enabled=false to manuallyPaused",
);

assert.equal(
  resolveMctbPauseKind({ ...base, manuallyPaused: true }, { enabled: false }, now),
  "manual",
  "resolve manual pause kind",
);
assert.equal(
  resolveMctbPauseKind({ ...base, pauseUntil: futurePause }, { enabled: true }, now),
  "timed",
  "resolve timed pause kind",
);

console.log("test-mctb-schedule-pause: ok");
