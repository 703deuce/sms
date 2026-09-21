/**
 * Contract checks for Voice V3 Google Calendar provider wiring (no live Google API).
 * Run: npx tsx scripts/test-voice-v3-google-calendar-provider.ts
 */
import assert from "node:assert/strict";
import {
  calendarProviderForBookingStrategy,
  isDirectCalendarBookingConfig,
  isDirectCalendarBookingStrategy,
} from "../src/lib/voice-v3/calendar/direct-booking-strategy";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { isVoiceV3ToolAuthorized } from "../src/lib/voice-v3/tools/authorize-tool-for-config";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";

function baseWizard(): AppointmentReceptionistWizardState {
  return {
    capabilities: ["book_appointments", "answer_questions"],
    bookingStrategy: "GOOGLE_CALENDAR",
    calendarProvider: "google",
    calendarConnected: true,
    calendarEmail: "owner@example.com",
    appointmentTypes: [
      {
        id: "svc_1",
        name: "Consultation",
        durationMin: 30,
        enabled: true,
        bookingPermission: "book_directly",
      },
    ],
    selectedAppointmentTypeId: "svc_1",
    timezone: "America/New_York",
    businessName: "Test Biz",
    agentName: "Amy",
  } as AppointmentReceptionistWizardState;
}

assert.equal(calendarProviderForBookingStrategy("GOOGLE_CALENDAR"), "google");
assert.equal(isDirectCalendarBookingStrategy("GOOGLE_CALENDAR"), true);

const compiled = compileVoiceV3AgentConfig({
  wizard: baseWizard(),
  providerConnections: {
    googleConnectionId: "conn_google_test",
    googleCalendarIds: ["primary"],
  },
  envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
});

assert.equal(compiled.scheduling.bookingStrategy, "GOOGLE_CALENDAR");
assert.equal(compiled.calendar?.provider, "google");
assert.equal(compiled.calendar?.connectionId, "conn_google_test");
assert.equal(compiled.bookingStrategyDetail?.executionStatus, "ACTIVE_EXECUTION");
assert.equal(isDirectCalendarBookingConfig(compiled), true);
assert.equal(isVoiceV3ToolAuthorized(compiled, "find_availability"), true);
assert.equal(isVoiceV3ToolAuthorized(compiled, "book_appointment"), true);

console.log("PASS voice-v3-google-calendar-provider contracts");
