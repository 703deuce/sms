/**
 * Integration-style checks for AR SMS routing helpers (no live carrier/calendar).
 * Run: npx tsx scripts/test-ar-ai-rescheduler-integration.ts
 */
import assert from "node:assert/strict";
import { evaluateArCustomerActionEligibility } from "../src/lib/appointment-reminders/ai-rescheduler/appointment-eligibility";
import { hasActiveArReminderSmsSession } from "../src/lib/appointment-reminders/ai-rescheduler/ar-sms-session";
import {
  mergeReminderContext,
  parseReminderContexts,
} from "../src/lib/appointment-reminders/ai-rescheduler/reminder-reply-context-store";
import { mergeConversationState } from "../src/lib/appointments/ai-scheduling/conversation-state";

const eligibility = evaluateArCustomerActionEligibility({
  appointmentId: "a1",
  contactId: null,
  status: "scheduled",
  metadata: { smsConsent: true },
});
assert.equal(eligibility.eligible, false);

const withContact = evaluateArCustomerActionEligibility({
  appointmentId: "a1",
  contactId: "c1",
  status: "scheduled",
  metadata: { smsConsent: true, inviteePhone: "+15551234567" },
  contactPhone: "+15551234567",
});
assert.equal(withContact.eligible, true);

const fields = mergeConversationState(null, {
  appointmentId: "appt-1",
  activeIntent: "RESCHEDULE",
});
assert.ok(hasActiveArReminderSmsSession(fields));

const ctx = mergeReminderContext(null, {
  appointmentId: "appt-1",
  sentAt: new Date().toISOString(),
  timelineType: "reminder_24h",
});
const parsed = parseReminderContexts(ctx);
assert.equal(parsed[0]?.timelineType, "reminder_24h");

console.log("PASS test-ar-ai-rescheduler-integration");
