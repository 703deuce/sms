/**
 * Google Calendar date/time adapter + normalizer certification (no live API).
 * Run: npx tsx scripts/test-google-calendar-datetime-adapter.ts
 */
import assert from "node:assert/strict";
import {
  canonicalUtcIntervalToGoogleTimedEventBounds,
  formatInstantAsGoogleLocalWallDateTime,
  googleWireToUtcInstant,
  toGoogleCalendarDateTimeField,
} from "../src/lib/voice-v3/calendar/google/google-datetime-adapter";
import {
  normalizeGoogleEventToBusyInterval,
} from "../src/lib/voice-v3/calendar/google/google-event-interval-normalizer";
import { wallTimeInZoneToUtc, zonedDateParts } from "../src/lib/voice-v3/time/timezone";

function assertRoundTrip(
  tz: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): void {
  const instant = wallTimeInZoneToUtc(tz, year, month, day, hour, minute, 0);
  const field = toGoogleCalendarDateTimeField(instant, tz);
  assert.equal(field.timeZone, tz);
  assert.match(field.dateTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  assert.ok(!field.dateTime.endsWith("Z"), "Google timed dateTime must be wall, not Z");
  const back = googleWireToUtcInstant(
    { dateTime: field.dateTime, timeZone: field.timeZone },
    tz,
  );
  assert.ok(back);
  assert.equal(back!.getTime(), instant.getTime(), `round-trip ${tz} ${year}-${month}-${day} ${hour}:${minute}`);
}

const US_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

// Same-day / tomorrow-style wall times (canonical instants, not NL parsing)
for (const tz of US_ZONES) {
  assertRoundTrip(tz, 2026, 9, 23, 14, 0);
  assertRoundTrip(tz, 2026, 9, 24, 9, 30);
}

// DST — US 2026: spring forward Mar 8, fall back Nov 1
for (const tz of US_ZONES) {
  assertRoundTrip(tz, 2026, 3, 9, 14, 0);
  assertRoundTrip(tz, 2026, 3, 9, 2, 30);
  assertRoundTrip(tz, 2026, 11, 2, 14, 0);
  assertRoundTrip(tz, 2026, 11, 2, 1, 30);
}

// UTC midnight crossing (evening local → next UTC day)
const nyLate = wallTimeInZoneToUtc("America/New_York", 2026, 9, 23, 21, 0, 0);
assert.ok(zonedDateParts(nyLate, "UTC").day === 24);

// Booking bounds must not pass Z strings as dateTime for IANA zones
const bounds = canonicalUtcIntervalToGoogleTimedEventBounds({
  startUtc: nyLate.toISOString(),
  endUtc: new Date(nyLate.getTime() + 60 * 60_000).toISOString(),
  timeZone: "America/New_York",
});
assert.ok(bounds);
assert.equal(bounds!.start.timeZone, "America/New_York");
assert.equal(formatInstantAsGoogleLocalWallDateTime(nyLate, "America/New_York"), "2026-09-23T21:00:00");

// Timed busy event with explicit offset in response
const timedBusy = normalizeGoogleEventToBusyInterval({
  calendarId: "primary",
  fallbackIanaTimeZone: "America/New_York",
  event: {
    start: { dateTime: "2026-09-23T14:00:00-04:00" },
    end: { dateTime: "2026-09-23T15:00:00-04:00" },
  },
});
assert.ok(timedBusy);

// Timed busy with wall + timeZone (Google style)
const timedBusy2 = normalizeGoogleEventToBusyInterval({
  calendarId: "primary",
  fallbackIanaTimeZone: "America/New_York",
  event: {
    start: { dateTime: "2026-09-23T14:00:00", timeZone: "America/New_York" },
    end: { dateTime: "2026-09-23T15:00:00", timeZone: "America/New_York" },
  },
});
assert.ok(timedBusy2);
assert.equal(
  timedBusy!.startUtc.slice(0, 16),
  timedBusy2!.startUtc.slice(0, 16),
  "offset vs wall+TZ should match same instant",
);

// All-day busy (exclusive end)
const allDay = normalizeGoogleEventToBusyInterval({
  calendarId: "primary",
  fallbackIanaTimeZone: "America/New_York",
  event: {
    start: { date: "2026-09-23" },
    end: { date: "2026-09-24" },
  },
});
assert.ok(allDay);
const allDayStartLocal = zonedDateParts(new Date(allDay!.startUtc), "America/New_York");
assert.equal(allDayStartLocal.year, 2026);
assert.equal(allDayStartLocal.month, 9);
assert.equal(allDayStartLocal.day, 23);
assert.equal(allDayStartLocal.hour, 0);

// Transparent / cancelled ignored
assert.equal(
  normalizeGoogleEventToBusyInterval({
    calendarId: "primary",
    fallbackIanaTimeZone: "America/New_York",
    event: {
      status: "cancelled",
      start: { dateTime: "2026-09-23T14:00:00-04:00" },
      end: { dateTime: "2026-09-23T15:00:00-04:00" },
    },
  }),
  null,
);

// Booking round-trip wire shape
const bookStart = wallTimeInZoneToUtc("America/New_York", 2026, 9, 23, 14, 0, 0);
const bookEnd = wallTimeInZoneToUtc("America/New_York", 2026, 9, 23, 15, 0, 0);
const wire = canonicalUtcIntervalToGoogleTimedEventBounds({
  startUtc: bookStart.toISOString(),
  endUtc: bookEnd.toISOString(),
  timeZone: "America/New_York",
});
assert.ok(wire);
const readBackStart = googleWireToUtcInstant(wire!.start, "America/New_York");
const readBackEnd = googleWireToUtcInstant(wire!.end, "America/New_York");
assert.equal(readBackStart!.getTime(), bookStart.getTime());
assert.equal(readBackEnd!.getTime(), bookEnd.getTime());
const p = zonedDateParts(bookStart, "America/New_York");
assert.equal(p.hour, 14);

console.log("PASS google-calendar-datetime-adapter certification");
