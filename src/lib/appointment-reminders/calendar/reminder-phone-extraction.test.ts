import assert from "node:assert/strict";
import {
  extractReminderPhoneFromCalendarEvent,
  mergeReminderPhoneOnImport,
} from "./reminder-phone-extraction";
import type { ProviderCalendarEvent } from "@/lib/calendar/providers";

function event(partial: Partial<ProviderCalendarEvent>): ProviderCalendarEvent {
  return {
    id: "evt-1",
    summary: "Test",
    description: "",
    location: "",
    start: new Date(),
    end: new Date(Date.now() + 3600000),
    status: "confirmed",
    attendees: [],
    ...partial,
  };
}

const labeled = extractReminderPhoneFromCalendarEvent(
  event({
    description: "Customer mobile: (571) 555-0188\nOffice: (703) 555-0199",
  }),
);
assert.equal(labeled.status, "found", "labeled customer mobile wins");
assert.ok(labeled.e164?.includes("5715550188") || labeled.e164?.includes("+15715550188"));

const ambiguous = extractReminderPhoneFromCalendarEvent(
  event({
    description: "Mary Johnson 571-555-0123. Also reach her at 703-555-0188",
  }),
);
assert.equal(ambiguous.status, "needs_review", "multiple unlabeled numbers need review");

const officeExcluded = extractReminderPhoneFromCalendarEvent(
  event({
    description: "Mary Johnson 571-555-0123. Office: 703-555-0188",
  }),
);
assert.equal(officeExcluded.status, "found", "labeled office number excluded from customer pick");

const single = extractReminderPhoneFromCalendarEvent(
  event({ summary: "John Smith - 703-555-0142" }),
);
assert.equal(single.status, "found", "single number in title");

const merged = mergeReminderPhoneOnImport({
  event: event({ summary: "Jane - 5715550199" }),
  contactPhone: null,
  previousMetadata: null,
});
assert.ok(merged.inviteePhone, "merge sets inviteePhone from extraction");

console.log("reminder-phone-extraction.test.ts: ok");
