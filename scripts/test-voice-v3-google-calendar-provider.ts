#!/usr/bin/env npx tsx
/**
 * Voice V3 Google Calendar provider wiring — config, authorization, adapter contracts.
 * Does not call live Google APIs (no credentials required).
 */
import assert from "node:assert/strict";
import { deriveBookingStrategyFromWizard } from "../src/lib/voice-receptionist-wizard/booking-strategy";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { isVoiceV3ToolAuthorized } from "../src/lib/voice-v3/tools/authorize-tool-for-config";
import { stableGoogleDiscoveryBookingId } from "../src/lib/voice-v3/calendar/google-discovery-selection-id";
import { resolveGoogleConnectionForWizard } from "../src/lib/voice-v3/config/resolve-google-connection";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { generateAvailabilitySlots } from "../src/lib/voice-v3/calendar/slot-generator";

function baseWizard(overrides: Partial<AppointmentReceptionistWizardState> = {}): AppointmentReceptionistWizardState {
  return {
    businessName: "Test Co",
    timezone: "America/New_York",
    capabilities: ["book_appointments"],
    calendarProvider: "google",
    calendarConnected: true,
    calendarEmail: "owner@gmail.com",
    bookingStrategy: "GOOGLE_CALENDAR",
    appointmentTypes: [
      {
        id: "svc1",
        name: "Consult",
        enabled: true,
        durationMinutes: 30,
        bookingPermission: "book_directly",
      },
    ],
    collectFields: [],
    ...overrides,
  } as AppointmentReceptionistWizardState;
}

function run(): void {
  // A. CONFIG / strategy derivation
  const derived = deriveBookingStrategyFromWizard(
    baseWizard({ bookingStrategy: undefined }),
  );
  assert.equal(derived, "GOOGLE_CALENDAR", "google + book_directly derives GOOGLE_CALENDAR");

  const compiled = compileVoiceV3AgentConfig({
    wizard: baseWizard(),
    providerConnections: {
      googleConnectionId: "conn_google_1",
      googleCalendarIds: ["primary"],
    },
    envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
    source: "wizard_published",
  });
  assert.equal(compiled.scheduling.bookingStrategy, "GOOGLE_CALENDAR");
  assert.equal(compiled.calendar?.provider, "google");
  assert.equal(compiled.calendar?.connectionId, "conn_google_1");
  assert.deepEqual(compiled.calendar?.calendarIds, ["primary"]);
  assert.notEqual(compiled.scheduling.bookingStrategy, "REQUEST_ONLY");

  // B. AUTHORIZATION
  const cfg = { ...compiled, capabilities: { ...compiled.capabilities, bookAppointments: true, checkAvailability: true, findAppointments: true, rescheduleAppointments: true, cancelAppointments: true } };
  assert.equal(isVoiceV3ToolAuthorized(cfg, "find_availability"), true);
  assert.equal(isVoiceV3ToolAuthorized(cfg, "book_appointment"), true);
  assert.equal(isVoiceV3ToolAuthorized(cfg, "find_appointment"), true);
  assert.equal(isVoiceV3ToolAuthorized(cfg, "reschedule_appointment"), true);
  assert.equal(isVoiceV3ToolAuthorized(cfg, "cancel_appointment"), true);

  // C. FIND slot path (provider-neutral after busy)
  const slots = generateAvailabilitySlots({
    timezone: "America/New_York",
    rangeStartUtc: "2026-09-22T12:00:00.000Z",
    rangeEndUtc: "2026-09-22T20:00:00.000Z",
    durationMinutes: 30,
    slotStepMinutes: 30,
    busyIntervals: [
      {
        calendarId: "primary",
        startUtc: "2026-09-22T14:00:00.000Z",
        endUtc: "2026-09-22T15:00:00.000Z",
      },
    ],
    businessHours: compiled.businessHours,
  });
  assert.ok(slots.length > 0, "slots generated from normalized busy");

  // G. discovery id stability
  const id1 = stableGoogleDiscoveryBookingId("c1", "primary", "evt123");
  const id2 = stableGoogleDiscoveryBookingId("c1", "primary", "evt123");
  assert.equal(id1, id2);
  assert.ok(id1.startsWith("gcal_disc_"));

  // connection resolve
  const picked = resolveGoogleConnectionForWizard(
    [{ id: "a", name: "x@gmail.com" }, { id: "b", name: "y@gmail.com" }],
    "y@gmail.com",
  );
  assert.equal(picked?.id, "b");

  console.log("VOICE_V3_GOOGLE_CALENDAR_PROVIDER: PASS");
}

run();
