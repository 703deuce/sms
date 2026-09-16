#!/usr/bin/env npx tsx
/**
 * SEND_LINK mode — headless certification.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-send-link-headless.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import { workflowNodeExpectedTools } from "../src/lib/voice/telnyx/conversation-workflow";
import { buildDesiredTelnyxWorkflowPayload } from "../src/lib/voice/telnyx/workflow-sync";
import {
  assertPublishableBookingLink,
  resolvePinnedBookingLink,
} from "../src/lib/voice-v2/booking-link-config";
import { deriveVoiceV2NextStage } from "../src/lib/voice-v2/booking-workflow";
import { resolveVoiceV2BookingStrategy } from "../src/lib/voice-v2/booking-strategy";
import { getIntakeReadiness } from "../src/lib/voice-v2/intake/readiness";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-v2/intake/compile-schema";
import {
  buildVoiceV2CallCapabilitySnapshot,
  verifyVoiceV2WorkflowReadBack,
} from "../src/lib/voice-v2/workflow-capability";
import {
  VOICE_V2_SEND_BOOKING_LINK_BODY,
  VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME,
} from "../src/lib/voice-v2/telnyx-tool-definition";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const TEST_LINK = "https://book.example.com/schedule";

function configForStrategy(
  strategy: "SEND_LINK" | "MICROSOFT_365" | "REQUEST_ONLY",
): VoiceAgentConfig {
  const wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard.bookingStrategy = strategy;
  wizard.capabilities = [...new Set([...wizard.capabilities, "book_appointments"])];
  if (strategy === "SEND_LINK") {
    wizard.bookingLinkUrl = TEST_LINK;
    wizard.appointmentTypes = wizard.appointmentTypes.map((t) => ({
      ...t,
      bookingPermission: "send_booking_link",
    }));
  } else if (strategy === "MICROSOFT_365") {
    wizard.calendarConnected = true;
    wizard.calendarProvider = "microsoft";
    wizard.appointmentTypes = wizard.appointmentTypes.map((t) => ({
      ...t,
      bookingPermission: "book_directly",
    }));
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

const v2SendIds = {
  findId: null,
  bookId: null,
  saveIntakeId: "v2_save",
  finalizeRequestId: null,
  sendBookingLinkId: "v2_send_link",
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

// Config compile + URL trust
const sendCfg = configForStrategy("SEND_LINK");
assert.equal(resolveVoiceV2BookingStrategy(sendCfg), "SEND_LINK");
const pinned = resolvePinnedBookingLink(sendCfg);
assert.ok(pinned?.url === TEST_LINK);
assert.equal(assertPublishableBookingLink(sendCfg).ok, true);
assert.equal(assertPublishableBookingLink(configForStrategy("MICROSOFT_365")).ok, true);

// Tool body must not accept arbitrary URL from model
const bodyProps = (VOICE_V2_SEND_BOOKING_LINK_BODY as { properties?: Record<string, unknown> })
  .properties;
assert.ok(!bodyProps?.url && !bodyProps?.booking_url);

// Tool eligibility
const plan = buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: v2SendIds,
  config: sendCfg,
});
const tools = workflowNodeExpectedTools("n_general", {
  voiceV2SaveIntake: v2SendIds.saveIntakeId,
  voiceV2SendBookingLink: v2SendIds.sendBookingLinkId,
  voiceV2Find: null,
  voiceV2Book: null,
});
assert.deepEqual(tools, ["voice_v2_save_intake_fields", "voice_v2_send_booking_link"]);

const msCfg = configForStrategy("MICROSOFT_365");
const msTools = workflowNodeExpectedTools("n_general", {
  voiceV2SaveIntake: "v2_save",
  voiceV2FinalizeRequest: "v2_finalize",
  voiceV2Find: "v2_find",
  voiceV2Book: "v2_book",
});
assert.ok(msTools.includes("voice_v2_find_availability"));
assert.ok(!msTools.includes("voice_v2_send_booking_link"));

// Workflow stage — booking intent → send link (no scheduling date required)
const schema = compileVoiceV2IntakeSchema(sendCfg);
const ctx: VoiceV2CallContext = {
  sessionKey: "cc:send-link-test",
  workspaceId: "ws_test",
  agentId: "agent_test",
  businessTimezone: "America/Los_Angeles",
  intakeSchema: schema,
  intakeState: {
    name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: new Date().toISOString() },
    service_reason: {
      value: "kitchen leak",
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
  },
  askedFields: {},
  compiledAt: new Date().toISOString(),
  capabilities: { bookingStrategy: "SEND_LINK", voiceV2PstnLiveBooking: false },
  bookingWorkflow: {
    bookingIntentActive: true,
    callbackRequested: false,
    bookingCancelled: false,
    bookingConfirmed: false,
    callerRequestFinalized: false,
    bookingLinkSent: false,
    deliveryDestinationE164: null,
    requestedDate: null,
    lastFindRequestedDate: null,
    nextStage: "COLLECT_REQUIRED_INTAKE",
  },
};
const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
const stage = deriveVoiceV2NextStage({
  workflow: ctx.bookingWorkflow!,
  readiness,
  hasActiveOfferSet: false,
  bookingStrategy: "SEND_LINK",
});
assert.equal(stage, "SEND_BOOKING_LINK");

const snap = buildVoiceV2CallCapabilitySnapshot(sendCfg);
assert.equal(snap.bookingStrategy, "SEND_LINK");
assert.equal(snap.findToolAvailable, false);
assert.equal(snap.sendBookingLinkToolAvailable, true);

const flow = plan.conversation_flow;
const general = (flow.nodes as Array<{ id: string; shared_tool_ids?: string[] }>).find(
  (n) => n.id === "n_general",
);
const readBack = verifyVoiceV2WorkflowReadBack({
  expectedVoiceV2Booking: false,
  expectedOneAmySendLink: true,
  readBack: {
    tool_ids: plan.tool_ids,
    generalNode: {
      id: "n_general",
      shared_tool_ids: general?.shared_tool_ids,
      instructions: "",
    },
    liveBookingNode: null,
    displayNameByToolId: new Map([
      ["v2_save", "transovo-voice-v2-save-intake-fields"],
      ["v2_send_link", VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME],
    ]),
  },
});
assert.equal(readBack.ok, true);

// Mode switch SEND_LINK → MICROSOFT_365
const msPlan = buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: {
    findId: "v2_find",
    bookId: "v2_book",
    saveIntakeId: "v2_save",
    finalizeRequestId: "v2_finalize",
    sendBookingLinkId: null,
    findExistingId: null,
    rescheduleId: null,
    cancelId: null,
  },
  config: msCfg,
});
assert.ok(msPlan.v2PstnLiveBooking);

console.log("test-voice-v2-send-link-headless: PASS");
