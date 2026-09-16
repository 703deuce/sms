#!/usr/bin/env npx tsx
/**
 * CALENDLY live booking mode — headless certification.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-calendly-headless.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import { workflowNodeExpectedTools } from "../src/lib/voice/telnyx/conversation-workflow";
import { buildDesiredTelnyxWorkflowPayload } from "../src/lib/voice/telnyx/workflow-sync";
import {
  assertPublishableCalendlyBooking,
  resolveVoiceV2CalendlyBookingConfig,
} from "../src/lib/voice-v2/calendly-booking-config";
import { mapCalendlyAvailabilityToVoiceV2Slots } from "../src/lib/voice-v2/calendly-slot-map";
import {
  isVoiceV2PstnLiveBookingMode,
  isVoiceV2PstnOneAmyMode,
  resolveVoiceV2BookingStrategy,
  voiceV2StrategyAllowsFindBook,
} from "../src/lib/voice-v2/booking-strategy";
import { deriveVoiceV2NextStage } from "../src/lib/voice-v2/booking-workflow";
import { getIntakeReadiness } from "../src/lib/voice-v2/intake/readiness";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-v2/intake/compile-schema";
import { buildVoiceV2CallCapabilitySnapshot } from "../src/lib/voice-v2/workflow-capability";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const EVENT_URI = "https://api.calendly.com/event_types/AAAAAAAA";

function configForStrategy(
  strategy: "CALENDLY" | "MICROSOFT_365" | "SEND_LINK" | "REQUEST_ONLY" | "NONE",
): VoiceAgentConfig {
  const wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard.bookingStrategy = strategy;
  wizard.capabilities = [...new Set([...wizard.capabilities, "book_appointments"])];
  if (strategy === "CALENDLY") {
    wizard.calendarConnected = true;
    wizard.calendarProvider = "calendly";
    wizard.calendlyEventTypeUri = EVENT_URI;
    wizard.calendlyEventTypeName = "Consultation";
    wizard.calendlyEventTypeDurationMin = 30;
    wizard.appointmentTypes = wizard.appointmentTypes.map((t) => ({
      ...t,
      bookingPermission: "book_directly",
    }));
  } else if (strategy === "MICROSOFT_365") {
    wizard.calendarConnected = true;
    wizard.calendarProvider = "microsoft";
    wizard.appointmentTypes = wizard.appointmentTypes.map((t) => ({
      ...t,
      bookingPermission: "book_directly",
    }));
  } else if (strategy === "SEND_LINK") {
    wizard.bookingLinkUrl = "https://book.example.com/schedule";
  }
  const advanced = mergeAppointmentWizardAdvanced(wizard, {});
  return applyAmyMinimumSideEffectConfig({
    enabledBuiltinTools: [],
    advanced: {
      appointmentReceptionistWizard: wizard,
      ...advanced,
      conversationWorkflowMode: true,
    },
  } as VoiceAgentConfig);
}

const v2LiveIds = {
  findId: "v2_find",
  bookId: "v2_book",
  saveIntakeId: "v2_save",
  finalizeRequestId: "v2_finalize",
  sendBookingLinkId: null,
  findExistingId: null,
  rescheduleId: null,
  cancelId: null,
};

const baseShared = {
  sendResourceId: "st_send",
  searchDetailsId: "st_search",
  voiceAiBookingId: "st_legacy",
  hangupId: "st_hangup",
  transferId: "st_transfer",
};

// CALENDLY_CONFIG_COMPILE
const calCfg = configForStrategy("CALENDLY");
assert.equal(resolveVoiceV2BookingStrategy(calCfg), "CALENDLY");
assert.ok(isVoiceV2PstnLiveBookingMode(calCfg));
assert.ok(isVoiceV2PstnOneAmyMode(calCfg));
assert.ok(voiceV2StrategyAllowsFindBook("CALENDLY"));
const pinnedCal = resolveVoiceV2CalendlyBookingConfig(calCfg);
assert.equal(pinnedCal?.eventTypeUri, EVENT_URI);
assert.equal(assertPublishableCalendlyBooking(calCfg).ok, true);

const missingEvent = configForStrategy("CALENDLY");
(missingEvent.advanced as Record<string, unknown>).voiceV2Calendly = undefined;
const w = (missingEvent.advanced as Record<string, unknown>).appointmentReceptionistWizard as {
  calendlyEventTypeUri?: string;
};
w.calendlyEventTypeUri = "";
assert.equal(assertPublishableCalendlyBooking(missingEvent).ok, false);

// CALENDLY_FIND_REAL_SLOT_MAPPING + OFFER_SET metadata
const slots = mapCalendlyAvailabilityToVoiceV2Slots({
  slots: [{ startTime: "2026-09-18T18:30:00.000Z", status: "available" }],
  timezone: "America/New_York",
  durationMinutes: 30,
  eventTypeUri: EVENT_URI,
  maxSlots: 3,
});
assert.equal(slots.length, 1);
assert.equal(slots[0].provider, "calendly");
assert.equal(slots[0].provider_metadata?.event_type_uri, EVENT_URI);
assert.equal(slots[0].provider_metadata?.calendly_start_time, "2026-09-18T18:30:00.000Z");

buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: v2LiveIds,
  config: calCfg,
});
const snap = buildVoiceV2CallCapabilitySnapshot(calCfg);
assert.equal(snap.findToolAvailable, true);
assert.equal(snap.bookToolAvailable, true);

const calTools = workflowNodeExpectedTools("n_general", {
  voiceV2SaveIntake: v2LiveIds.saveIntakeId,
  voiceV2FinalizeRequest: v2LiveIds.finalizeRequestId,
  voiceV2Find: v2LiveIds.findId,
  voiceV2Book: v2LiveIds.bookId,
});
assert.ok(calTools.includes("voice_v2_find_availability"));
assert.ok(calTools.includes("voice_v2_book_offered_slot"));
assert.ok(!calTools.includes("voice_v2_send_booking_link"));

// MODE_SWITCH
for (const mode of ["CALENDLY", "MICROSOFT_365", "SEND_LINK", "REQUEST_ONLY", "NONE"] as const) {
  const c = configForStrategy(mode);
  assert.equal(resolveVoiceV2BookingStrategy(c), mode);
}

// MICROSOFT regression — still live booking
const ms = configForStrategy("MICROSOFT_365");
assert.ok(isVoiceV2PstnLiveBookingMode(ms));
assert.ok(voiceV2StrategyAllowsFindBook("MICROSOFT_365"));
assert.equal(voiceV2StrategyAllowsFindBook("SEND_LINK"), false);

// CALENDLY workflow stage mirrors Microsoft live path
const schema = compileVoiceV2IntakeSchema(calCfg);
const intakeState = {
  name: {
    value: "Anthony",
    status: "CAPTURED",
    source: "CALLER",
    updatedAt: new Date().toISOString(),
  },
  email: {
    value: "anthony@example.com",
    status: "CAPTURED",
    source: "CALLER",
    updatedAt: new Date().toISOString(),
  },
  phone: {
    value: "+15551234567",
    status: "PREFILLED",
    source: "CALLER_ID",
    updatedAt: new Date().toISOString(),
  },
};
const readiness = getIntakeReadiness(schema, intakeState);
const stage = deriveVoiceV2NextStage({
  workflow: {
    bookingIntentActive: true,
    callbackRequested: false,
    bookingCancelled: false,
    bookingConfirmed: false,
    callerRequestFinalized: false,
    bookingLinkSent: false,
    requestedDate: "2026-09-18",
    lastFindRequestedDate: null,
    nextStage: "FIND_AVAILABILITY",
  },
  readiness,
  hasActiveOfferSet: false,
  bookingStrategy: "CALENDLY",
});
assert.equal(stage, "FIND_AVAILABILITY");

console.log("test-voice-v2-calendly-headless: PASS");
