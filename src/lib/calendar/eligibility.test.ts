import assert from "node:assert/strict";
import {
  isEventEligibleForCalendarMirror,
  isEventEligibleForReminderImport,
  mergeImportRules,
  organizerMatchesConnection,
} from "./eligibility";
import type { ProviderCalendarEvent } from "./providers";

const baseEvent: ProviderCalendarEvent = {
  id: "evt-1",
  summary: "Test",
  start: new Date("2026-10-14T12:00:00Z"),
  end: new Date("2026-10-14T12:30:00Z"),
  status: "confirmed",
  attendees: [],
  organizerEmail: "owner@example.com",
};

const mirror = isEventEligibleForCalendarMirror(baseEvent);
assert.equal(mirror.eligible, true);

const reminder = isEventEligibleForReminderImport(baseEvent, mergeImportRules({}), "owner@example.com");
assert.equal(reminder.eligible, false);
assert.equal(reminder.reason, "no_external_attendees");

const transovo = { ...baseEvent, transovoOriginated: true };
assert.equal(isEventEligibleForCalendarMirror(transovo).reason, "transovo_originated");

const colleagueOrganized = {
  ...baseEvent,
  organizerEmail: "colleague@example.com",
  attendees: [{ email: "client@other.com", name: "Client" }],
};
assert.equal(
  isEventEligibleForReminderImport(colleagueOrganized, mergeImportRules({}), "owner@example.com").reason,
  "organizer_not_connection",
);

const freeEvent = {
  ...baseEvent,
  showAs: "free",
  attendees: [{ email: "client@other.com" }],
};
assert.equal(
  isEventEligibleForReminderImport(freeEvent, mergeImportRules({}), "owner@example.com").reason,
  "show_as_free",
);

const internalOnly = {
  ...baseEvent,
  organizerEmail: "owner@acme.com",
  attendees: [{ email: "peer@acme.com", name: "Peer" }],
};
assert.equal(
  isEventEligibleForReminderImport(internalOnly, mergeImportRules({}), "owner@acme.com").reason,
  "internal_domain_only_attendees",
);

const outlookOrganizer = {
  ...baseEvent,
  summary: "5714776175",
  organizerEmail: "outlook_06671ca542cd25e1@outlook.com",
  attendees: [],
};
const outlookEligible = isEventEligibleForReminderImport(
  outlookOrganizer,
  mergeImportRules({}),
  "anthony@transovo.ai",
  { microsoftUserId: "06671ca542cd25e1", customerPhoneE164: "+15714776175" },
);
assert.equal(outlookEligible.eligible, true);

assert.equal(
  organizerMatchesConnection("outlook_06671CA542CD25E1@outlook.com", {
    connectionEmail: "anthony@transovo.ai",
    microsoftUserId: "06671ca542cd25e1",
  }),
  true,
);

console.log("eligibility.test.ts: ok");
