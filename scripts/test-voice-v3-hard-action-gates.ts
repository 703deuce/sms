#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { authorizeVoiceV3BookingMutation } from "../src/lib/voice-v3/policy/authorize-booking-mutation.ts";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config.ts";
import type { VoiceV3CallContext } from "../src/lib/voice-v3/state/call-context.ts";

function minimalCtx(overrides: Partial<VoiceV3CallContext> = {}): VoiceV3CallContext {
  const base = {
    liveSessionId: "lk_test",
    callId: "call_test",
    business: { timezone: "America/New_York", businessName: "Test" },
    telephony: { inboundCallerE164: "+15551234567" },
    scheduling: { generation: 1, preference: null },
    availability: {
      status: "ready",
      activeOfferSet: {
        offerSetId: "os1",
        schedulingGeneration: 1,
        timezone: "America/New_York",
        slots: [
          {
            slotId: "s1",
            startUtc: "2026-09-22T18:00:00.000Z",
            endUtc: "2026-09-22T19:00:00.000Z",
            localStart: "2026-09-22T14:00",
            localEnd: "2026-09-22T15:00",
          },
        ],
        createdAt: new Date().toISOString(),
      },
      lastFailure: null,
      inFlightGeneration: null,
      lastDispatchedRequestKey: null,
      findStartedAt: null,
    },
    selection: { selected: null, lastResolutionStatus: null },
    booking: { phase: "NONE", activeAttempt: null, confirmed: null, lastFailure: null, postBookChangeRequested: false, verbalConfirmation: "NOT_REQUIRED" },
    intake: { values: {}, objective: "book" },
    presentation: { current: null },
    runtime: { version: 1 },
    updatedAt: new Date().toISOString(),
  } as VoiceV3CallContext;
  return { ...base, ...overrides };
}

const selected = {
  offerSetId: "os1",
  slotId: "s1",
  schedulingGeneration: 1,
  startUtc: "2026-09-22T18:00:00.000Z",
  endUtc: "2026-09-22T19:00:00.000Z",
  localStart: "2026-09-22T14:00",
  localEnd: "2026-09-22T15:00",
  timezone: "America/New_York",
};

const staleGen = authorizeVoiceV3BookingMutation({
  config: VOICE_V3_BOOKING_AGENT_CONFIG,
  ctx: minimalCtx({ scheduling: { generation: 2, preference: null } }),
  selected,
  conversationRevisionAtStart: 0,
  liveSessionId: "lk_test",
});
assert.equal(staleGen.allowed, false);
assert.equal(staleGen.allowed === false && staleGen.code, "STALE_SCHEDULING_GENERATION");

console.log("test-voice-v3-hard-action-gates: PASS");
