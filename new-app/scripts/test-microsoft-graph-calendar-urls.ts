#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  microsoftCalendarViewUrl,
  microsoftCreateEventUrl,
  normalizeMicrosoftCalendarId,
} from "@/lib/server/voice-v3/scheduling/microsoft-graph-calendar-urls";

assert.equal(normalizeMicrosoftCalendarId("primary"), undefined);
assert.equal(normalizeMicrosoftCalendarId("  abc  "), "abc");

assert.equal(
  microsoftCalendarViewUrl({ calendarId: "primary" }),
  "https://graph.microsoft.com/v1.0/me/calendar/calendarView",
);
assert.equal(
  microsoftCalendarViewUrl({ calendarId: "AAMkAGI2..." }),
  "https://graph.microsoft.com/v1.0/me/calendars/AAMkAGI2.../calendarView",
);
assert.equal(
  microsoftCreateEventUrl({ calendarId: "primary" }),
  "https://graph.microsoft.com/v1.0/me/calendar/events",
);

console.log("PASS test-microsoft-graph-calendar-urls");
