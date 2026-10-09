import assert from "node:assert/strict";
import { mergeCalendarConnectionConfig } from "../src/lib/calendar/connection-config-merge";

const prev = {
  importCalendarIds: ["cal-a"],
  microsoftDeltaLinks: {
    "cal-a": {
      deltaLink: "https://graph.microsoft.com/delta-1",
      windowStart: "2026-10-01T00:00:00.000Z",
      windowEnd: "2027-01-01T00:00:00.000Z",
      updatedAt: "2026-10-09T13:48:00.000Z",
    },
  },
  microsoftSubscription: { id: "sub-1" },
};

const stalePatch = {
  importCalendarIds: ["cal-a"],
  lastSyncError: null,
};

const merged = mergeCalendarConnectionConfig(prev, stalePatch);
assert.equal(
  (merged.microsoftDeltaLinks as Record<string, { deltaLink: string }>)["cal-a"].deltaLink,
  "https://graph.microsoft.com/delta-1",
);
assert.equal((merged.microsoftSubscription as { id: string }).id, "sub-1");

const newerDelta = {
  microsoftDeltaLinks: {
    "cal-a": {
      deltaLink: "https://graph.microsoft.com/delta-2",
      windowStart: "2026-10-01T00:00:00.000Z",
      windowEnd: "2027-01-01T00:00:00.000Z",
      updatedAt: "2026-10-09T14:00:00.000Z",
    },
  },
};
const mergedNewer = mergeCalendarConnectionConfig(prev, newerDelta);
assert.equal(
  (mergedNewer.microsoftDeltaLinks as Record<string, { deltaLink: string }>)["cal-a"].deltaLink,
  "https://graph.microsoft.com/delta-2",
);

console.log("test-calendar-config-merge: PASS");
