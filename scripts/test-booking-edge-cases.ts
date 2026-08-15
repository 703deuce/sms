/**
 * Edge-case contract tests for booking orchestration (5 manual test categories).
 * Run: npx tsx scripts/test-booking-edge-cases.ts
 */
import assert from "node:assert/strict";
import { ChatContext } from "@livekit/agents";
import { applyReceptionistFieldBackfill } from "../src/lib/voice/receptionist/field-backfill";
import type { AgentFieldDefinition } from "../src/lib/voice/receptionist/types";
import {
  afterReceptionistFieldPersisted,
  invalidateStaleSlotSelection,
  markFieldAuthoritative,
} from "../voice-runtime/src/frontdesk/booking-field-coherence";
import {
  beginBookingOperation,
  finalizeScheduleAppointmentAttempt,
  markBookingOperationConfirmed,
  markBookingOperationFailed,
  resetBookingOperationForRetry,
  canStartScheduleAppointment,
} from "../voice-runtime/src/frontdesk/booking-operation";
import { deriveAuthoritativeBookingState } from "../voice-runtime/src/frontdesk/booking-state";
import { persistConfirmedBookingEmail } from "../voice-runtime/src/frontdesk/booking-email-state";
import {
  isBookingConfirmed,
  markBookingConfirmed,
  type FrontDeskUserData,
} from "../voice-runtime/src/frontdesk/userdata";

function baseUd(overrides: Partial<FrontDeskUserData> = {}): FrontDeskUserData {
  return {
    workspaceId: "ws",
    agentId: "agent",
    callId: "call",
    businessName: "Test HVAC",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
    receptionistFields: {},
    ...overrides,
  };
}

// --- 1. Rapid correction / contradiction ---
const correctionUd = baseUd();
correctionUd.receptionistFields!.phone = "+17035559999";
afterReceptionistFieldPersisted(correctionUd, "phone", "+17035559999", "571-555-1212");
assert.equal(correctionUd.receptionistFields?.phone, "+17035559999");
assert.ok(correctionUd.authoritativeFieldIds?.includes("phone"));

const manifest: AgentFieldDefinition[] = [
  { id: "phone", label: "phone", type: "phone", required: true, question: "Phone?" },
  { id: "address", label: "address", type: "address", required: false, question: "Address?" },
];
const chat = ChatContext.empty();
chat.addMessage({ role: "user", content: "My number is 571-555-1212" });
const backfilled = applyReceptionistFieldBackfill({
  chatCtx: chat,
  manifest,
  receptionistFields: correctionUd.receptionistFields!,
  authoritativeFieldIds: correctionUd.authoritativeFieldIds,
});
assert.equal(backfilled.phone, "+17035559999", "authoritative correction beats stale chat backfill");

// --- 2. Time preference invalidates stale slot ---
const slotUd = baseUd({ pendingSlotId: "ST_old", receptionistFields: { preferred_time: "Tuesday 9am" } });
beginBookingOperation(slotUd, "ST_old");
const invalidated = invalidateStaleSlotSelection(slotUd, "time_preference_changed");
assert.equal(invalidated, true);
assert.equal(slotUd.pendingSlotId, undefined);
assert.equal(slotUd.bookingOperation, undefined);

afterReceptionistFieldPersisted(slotUd, "preferred_time", "Wednesday morning", "Tuesday 9am");
assert.equal(slotUd.pendingSlotId, undefined);

// --- 3. Interrupt / confirmed write reconciliation ---
const confirmedUd = baseUd();
beginBookingOperation(confirmedUd, "ST_ok");
confirmedUd.bookingInProgress = true;
markBookingConfirmed(confirmedUd, {
  slotId: "ST_ok",
  providerEventId: "https://calendly.com/event/abc",
  bookedTimeLabel: "Monday 9 AM",
});
finalizeScheduleAppointmentAttempt(confirmedUd);
assert.equal(isBookingConfirmed(confirmedUd), true);
assert.equal(confirmedUd.bookingOperation?.state, "confirmed");
assert.notEqual(confirmedUd.bookingOperation?.errorReason, "booking_interrupted");

// --- 4. Provider failure retry clears failed op ---
const failedUd = baseUd();
beginBookingOperation(failedUd, "ST_fail");
markBookingOperationFailed(failedUd, "rate_limited");
assert.equal(canStartScheduleAppointment(failedUd), true);
resetBookingOperationForRetry(failedUd);
assert.equal(failedUd.bookingOperation, undefined);
assert.equal(canStartScheduleAppointment(failedUd), true);

// --- 5. Email correction + intent whiplash (fields survive) ---
const emailUd = baseUd({ receptionistFields: { name: "Anthony", reason: "AC issue" } });
persistConfirmedBookingEmail(emailUd, "anthony@yahoo.com");
persistConfirmedBookingEmail(emailUd, "anthony@gmail.com");
assert.equal(emailUd.confirmedEmail, "anthony@gmail.com");
emailUd.receptionistMessageTaken = true;
const stateAfterMessage = deriveAuthoritativeBookingState(emailUd);
assert.equal(stateAfterMessage.fields.name, "Anthony");
assert.equal(stateAfterMessage.confirmedEmail, "anthony@gmail.com");
assert.equal(stateAfterMessage.fields.reason, "AC issue");

console.log("test-booking-edge-cases: PASS (contracts for 5 manual edge-case categories)");
