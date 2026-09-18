import assert from "node:assert/strict";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function main() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  const ctx = createInitialVoiceV3CallContext({
    callId: "claims_call",
    liveSessionId: "claims_live",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });

  const pending = {
    ...ctx,
    availability: {
      ...ctx.availability,
      status: "pending" as const,
      findStartedAt: NOW.toISOString(),
      inFlightGeneration: 1,
    },
  };

  const snap = planAgentState(pending, CONFIG);
  assert.ok(snap.allowedClaims.includes("CLAIM_CHECKING_AVAILABILITY"));
  assert.ok(snap.forbiddenClaims.includes("CLAIM_BOOKED"));
  assert.equal(snap.nextConversationAction.type, "ACKNOWLEDGE_PENDING_ACTION");

  console.log("VOICE_V3_AGENT_CLAIMS_PASS");
}

main();
