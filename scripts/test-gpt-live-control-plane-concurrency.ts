/**
 * Two simultaneous GPT-Live control planes must not share workflow stage or active tools.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-gpt-live-control-plane-concurrency.ts
 */
import assert from "node:assert/strict";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { defaultVoiceV2BookingWorkflow } from "@/lib/voice-receptionist-wizard/booking-workflow";
import { clearVoiceV2CallSessions, setVoiceV2CallContext } from "@/lib/voice-receptionist-wizard/intake/session-store";
import type { VoiceV2CallContext } from "@/lib/voice-receptionist-wizard/intake/types";
import { createLiveControlPlane } from "@/lib/voice/telnyx/openai-live-bridge/live-control-plane";
import type { RealtimeBridgeStreamClaims } from "@/lib/voice/telnyx/openai-realtime-bridge/stream-token";

const TEST_CONFIG = {
  advanced: {
    appointmentReceptionistWizard: {
      bookingStrategy: "MICROSOFT_365",
      knowledgeItems: [],
    },
  },
} as VoiceAgentConfig;

function baseContext(sessionKey: string): VoiceV2CallContext {
  return {
    sessionKey,
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/New_York",
    intakeSchema: { fields: [] },
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: {
      voiceV2PstnLiveBooking: true,
      bookingStrategy: "MICROSOFT_365",
    },
    bookingWorkflow: defaultVoiceV2BookingWorkflow(),
  };
}

function claims(callId: string, callControlId: string): RealtimeBridgeStreamClaims {
  return {
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId,
    callControlId,
  };
}

function main() {
  clearVoiceV2CallSessions();

  const keyA = "cc:sim-call-a";
  const keyB = "cc:sim-call-b";

  setVoiceV2CallContext({
    ...baseContext(keyA),
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      requestedDate: "2026-09-24",
      nextStage: "OFFER_SLOTS",
    },
    currentOfferSet: { offerSetId: "v2offer_a", slotIds: ["slot_a1"] },
  });

  setVoiceV2CallContext({
    ...baseContext(keyB),
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: false,
      nextStage: "COLLECT_REQUIRED_INTAKE",
    },
  });

  const planeA = createLiveControlPlane({
    claims: claims("call-a", "sim-call-a"),
    initialConfig: TEST_CONFIG,
  });
  const planeB = createLiveControlPlane({
    claims: claims("call-b", "sim-call-b"),
    initialConfig: TEST_CONFIG,
  });
  planeA.setLiveSessionId("live_sess_a");
  planeB.setLiveSessionId("live_sess_b");

  const toolsA = planeA.getActiveTools().map((t) => t.name).sort();
  const toolsB = planeB.getActiveTools().map((t) => t.name).sort();

  assert.equal(planeA.getStage(), "OFFER_SLOTS");
  assert.equal(planeB.getStage(), "COLLECT_REQUIRED_INTAKE");
  assert.notDeepEqual(toolsA, toolsB);
  assert.ok(toolsA.includes("voice_v2_book_offered_slot"));
  assert.deepEqual(toolsB, ["voice_v2_save_intake_fields"]);

  setVoiceV2CallContext({
    ...baseContext(keyA),
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      bookingConfirmed: true,
      nextStage: "BOOKING_CONFIRMED",
    },
  });
  planeA.invalidateContextCache();

  assert.equal(planeA.getStage(), "BOOKING_CONFIRMED");
  assert.equal(planeA.getActiveTools().length, 0);
  assert.equal(planeB.getStage(), "COLLECT_REQUIRED_INTAKE");
  assert.deepEqual(planeB.getActiveTools().map((t) => t.name), ["voice_v2_save_intake_fields"]);

  setVoiceV2CallContext({
    ...baseContext(keyB),
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      requestedDate: "2026-09-20",
      nextStage: "FIND_AVAILABILITY",
    },
  });
  planeB.invalidateContextCache();

  assert.equal(planeB.getStage(), "FIND_AVAILABILITY");
  assert.deepEqual(planeB.getActiveTools().map((t) => t.name), ["voice_v2_find_availability"]);
  assert.equal(planeA.getStage(), "BOOKING_CONFIRMED");
  assert.equal(planeA.isBookingConfirmed(), true);
  assert.equal(planeA.getActiveTools().length, 0);

  console.log("PASS gpt-live control plane concurrent isolation");
}

main();
