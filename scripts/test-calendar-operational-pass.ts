/**
 * Calendar operational continuation — focused unit checks.
 * npx tsx scripts/test-calendar-operational-pass.ts
 */
import assert from "node:assert/strict";
import {
  buildCalendarSearchParams,
  parseCalendarFiltersFromSearch,
  parseCalendarView,
} from "../src/features/appointments/kimi/calendar/calendar-url-state";
import {
  dayIndexFromPointer,
  decimalHourFromPointer,
  isReschedulableCalendarEventId,
  snapDecimalHour,
} from "../src/features/appointments/kimi/calendar/calendar-drag-math";
import { entryMatchesWaitlistSlotPreferences } from "../src/lib/appointments/calendar-waitlist-slot-match-pure";

assert.equal(parseCalendarView("week"), "week");
assert.equal(parseCalendarView("bogus"), "week");

const filters = parseCalendarFiltersFromSearch(
  new URLSearchParams("staff=a,b&location=loc1&status=confirmed&type=service&q=test"),
);
assert.deepEqual(filters.staffIds, ["a", "b"]);
assert.equal(filters.locationId, "loc1");
assert.equal(filters.status, "confirmed");

const built = buildCalendarSearchParams({
  view: "week",
  cursor: new Date("2026-09-12T12:00:00Z"),
  selectedDayKey: "Sat Sep 12 2026",
  filters,
});
assert.equal(built.get("view"), "week");
assert.ok(built.get("date"));

assert.equal(snapDecimalHour(9.17), 9.25);
assert.equal(dayIndexFromPointer(0, 700, 100, 48), 0);
assert.equal(isReschedulableCalendarEventId("appt-1"), true);
assert.equal(isReschedulableCalendarEventId("class:1"), false);

const hour = decimalHourFromPointer(100, 200, 0);
assert.ok(hour >= 8 && hour <= 19);

assert.equal(
  entryMatchesWaitlistSlotPreferences(
    { serviceName: "Massage", staffPreference: "s1", preferredDate: "2026-09-15" },
    {
      workspaceId: "w",
      startsAt: "2026-09-15T14:00:00.000Z",
      serviceName: "Massage",
      staffId: "s1",
    },
  ),
  true,
);

assert.equal(
  entryMatchesWaitlistSlotPreferences(
    { serviceName: "Massage", staffPreference: "s2" },
    {
      workspaceId: "w",
      startsAt: "2026-09-15T14:00:00.000Z",
      serviceName: "Massage",
      staffId: "s1",
    },
  ),
  false,
);

console.log("test-calendar-operational-pass: OK");
