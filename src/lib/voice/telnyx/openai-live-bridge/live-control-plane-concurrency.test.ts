import { describe, expect, it, beforeEach } from "vitest";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { defaultVoiceV2BookingWorkflow } from "@/lib/voice-v2/booking-workflow";
import { clearVoiceV2CallSessions, setVoiceV2CallContext } from "@/lib/voice-v2/intake/session-store";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";
import { createLiveControlPlane } from "./live-control-plane";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";

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

function planeFor(callId: string, cc: string) {
  return createLiveControlPlane({
    claims: claims(callId, cc),
    initialConfig: TEST_CONFIG,
  });
}

describe("GPT-Live control plane concurrent call isolation", () => {
  beforeEach(() => {
    clearVoiceV2CallSessions();
  });

  it("keeps workflow stage and active tools isolated across two simultaneous runtimes", () => {
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

    const planeA = planeFor("call-a", "sim-call-a");
    const planeB = planeFor("call-b", "sim-call-b");
    planeA.setLiveSessionId("live_sess_a");
    planeB.setLiveSessionId("live_sess_b");

    const toolsA = planeA.getActiveTools().map((t) => t.name).sort();
    const toolsB = planeB.getActiveTools().map((t) => t.name).sort();

    expect(planeA.getStage()).toBe("OFFER_SLOTS");
    expect(planeB.getStage()).toBe("COLLECT_REQUIRED_INTAKE");
    expect(toolsA).not.toEqual(toolsB);
    expect(toolsA).toContain("voice_v2_book_offered_slot");
    expect(toolsB).toEqual(["voice_v2_save_intake_fields"]);

    setVoiceV2CallContext({
      ...baseContext(keyA),
      bookingWorkflow: {
        ...defaultVoiceV2BookingWorkflow(),
        bookingIntentActive: true,
        bookingConfirmed: true,
        nextStage: "BOOKING_CONFIRMED",
      },
      currentOfferSet: undefined,
    });
    planeA.invalidateContextCache();

    expect(planeA.getStage()).toBe("BOOKING_CONFIRMED");
    expect(planeA.getActiveTools()).toHaveLength(0);
    expect(planeB.getStage()).toBe("COLLECT_REQUIRED_INTAKE");
    expect(planeB.getActiveTools().map((t) => t.name)).toEqual(["voice_v2_save_intake_fields"]);

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

    expect(planeB.getStage()).toBe("FIND_AVAILABILITY");
    expect(planeB.getActiveTools().map((t) => t.name)).toEqual(["voice_v2_find_availability"]);
    expect(planeA.getStage()).toBe("BOOKING_CONFIRMED");
    expect(planeA.isBookingConfirmed()).toBe(true);
    expect(planeA.getActiveTools()).toHaveLength(0);
  });
});
