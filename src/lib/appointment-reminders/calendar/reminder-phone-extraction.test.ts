import assert from "node:assert/strict";
import {
  extractReminderPhoneFromCalendarEvent,
  mergeReminderPhoneOnImport,
  resolveReminderPhoneWithLunaFallback,
} from "./reminder-phone-extraction";
import type { ProviderCalendarEvent } from "@/lib/calendar/providers";
import type { LunaReminderPhoneResult } from "./reminder-phone-evidence";

async function run() {
function event(partial: Partial<ProviderCalendarEvent>): ProviderCalendarEvent {
  return {
    id: "evt-1",
    summary: "Test",
    description: "",
    locationDisplay: "",
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

const mockLunaSuccess: (e: ProviderCalendarEvent) => Promise<LunaReminderPhoneResult> = async () => ({
  ok: true,
  e164: "+15715550123",
  sourceField: "description",
  evidence: "Mary Johnson 571-555-0123",
});

const lunaResolved = await resolveReminderPhoneWithLunaFallback(
  event({
    description: "Mary Johnson 571-555-0123. Also reach her at 703-555-0188",
  }),
  { lunaExtract: mockLunaSuccess },
);
assert.equal(lunaResolved.status, "found", "luna resolves ambiguous parser result");
assert.equal(lunaResolved.method, "luna");

const mockLunaFail: () => Promise<LunaReminderPhoneResult> = async () => ({
  ok: false,
  reason: "luna_no_number",
});

const lunaFailed = await resolveReminderPhoneWithLunaFallback(
  event({ description: "Appointment for Mary. Contact details to follow." }),
  { lunaExtract: mockLunaFail },
);
assert.equal(lunaFailed.status, "missing", "no number stays missing after luna");
assert.ok(lunaFailed.lunaAttemptedAt, "luna attempt recorded");

const merged = await mergeReminderPhoneOnImport(
  {
    event: event({ summary: "Jane - 5715550199" }),
    contactPhone: null,
    previousMetadata: null,
  },
  { lunaExtract: mockLunaFail },
);
assert.ok(merged.inviteePhone, "merge sets inviteePhone from parser without luna");

const locked = await mergeReminderPhoneOnImport(
  {
    event: event({ summary: "Changed - 9999999999" }),
    contactPhone: null,
    previousMetadata: {
      inviteePhone: "+15551234567",
      reminderPhoneUserLocked: true,
      reminderPhone: { status: "found", fingerprint: "old" },
    },
  },
  { lunaExtract: mockLunaFail },
);
assert.equal(locked.inviteePhone, "+15551234567", "manual lock preserved");

const cached = await mergeReminderPhoneOnImport(
  {
    event: event({ summary: "Jane - 5715550199" }),
    contactPhone: null,
    previousMetadata: {
      inviteePhone: "+15715550199",
      reminderPhone: {
        status: "found",
        fingerprint: extractReminderPhoneFromCalendarEvent(
          event({ summary: "Jane - 5715550199" }),
        ).fingerprint,
        lunaAttemptedAt: new Date().toISOString(),
      },
    },
  },
  {
    lunaExtract: async () => {
      throw new Error("luna should not run when fingerprint unchanged and found");
    },
  },
);
assert.equal(cached.inviteePhone, "+15715550199", "unchanged event reuses stored phone");

console.log("reminder-phone-extraction.test.ts: ok");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
