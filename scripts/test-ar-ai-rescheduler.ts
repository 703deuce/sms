import assert from "node:assert/strict";
import {
  isAiAutomaticCalendarMutation,
  isAiBusinessApprovalMode,
  DEFAULT_AI_RESCHEDULER_CONFIG,
} from "../src/lib/appointment-reminders/ai-rescheduler/types";
import { parseImportedExternalId } from "../src/lib/calendar/external-id";
import {
  applyArRescheduleRules,
  slotPassesArWeeklyHours,
} from "../src/lib/appointment-reminders/ai-rescheduler/availability-rules";
import { evaluateArCalendarReadiness } from "../src/lib/appointment-reminders/ai-rescheduler/calendar-readiness";
import { evaluateArCustomerActionEligibility } from "../src/lib/appointment-reminders/ai-rescheduler/appointment-eligibility";

assert.equal(DEFAULT_AI_RESCHEDULER_CONFIG.mode, "notify");
assert.equal(isAiAutomaticCalendarMutation({ ...DEFAULT_AI_RESCHEDULER_CONFIG, mode: "ai" }), true);
assert.equal(
  isAiAutomaticCalendarMutation({ ...DEFAULT_AI_RESCHEDULER_CONFIG, mode: "notify" }),
  false,
);
assert.equal(
  isAiBusinessApprovalMode({ ...DEFAULT_AI_RESCHEDULER_CONFIG, mode: "ai", approval: "business" }),
  true,
);

const parsed = parseImportedExternalId("microsoft:conn1:event123");
assert.ok(parsed);
assert.equal(parsed?.eventId, "event123");

const tz = "America/New_York";
const mondaySlot = "2026-10-12T14:00:00.000Z";
assert.ok(
  slotPassesArWeeklyHours(mondaySlot, "2026-10-12T14:30:00.000Z", tz, DEFAULT_AI_RESCHEDULER_CONFIG.weeklyHours),
);

const now = new Date("2026-10-07T12:00:00.000Z");
const filtered = applyArRescheduleRules(
  [{ startsAt: "2026-10-07T12:30:00.000Z", endsAt: "2026-10-07T13:00:00.000Z" }],
  { timezone: tz, ar: DEFAULT_AI_RESCHEDULER_CONFIG, now },
);
assert.equal(filtered.length, 0, "minimum notice should filter near-term slot");

const ready = evaluateArCalendarReadiness({ provider: null, connectionStatus: null });
assert.equal(ready.level, 0);

assert.equal(
  evaluateArCustomerActionEligibility({
    appointmentId: "x",
    contactId: "c",
    status: "scheduled",
    metadata: { internalBlock: true },
  }).eligible,
  false,
);

console.log("PASS test-ar-ai-rescheduler");
