import assert from "node:assert/strict";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import { startOperation, transitionOperation } from "../src/lib/voice-v3/operations/registry";
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

  let pending = {
    ...ctx,
    availability: {
      ...ctx.availability,
      status: "pending" as const,
      findStartedAt: NOW.toISOString(),
      inFlightGeneration: 1,
    },
  };
  pending = startOperation(pending, {
    operationId: "find_claims_test",
    type: "FIND_AVAILABILITY",
    schedulingGeneration: 1,
  });

  const snap = planAgentState(pending, CONFIG);
  assert.ok(snap.allowedClaims.includes("CLAIM_CHECKING_AVAILABILITY"));
  assert.ok(snap.forbiddenClaims.includes("CLAIM_BOOKED"));
  assert.equal(snap.nextConversationAction.type, "ACKNOWLEDGE_PENDING_ACTION");

  let booked = {
    ...ctx,
    booking: {
      ...ctx.booking,
      phase: "BOOKING_CONFIRMED" as const,
      confirmed: {
        bookingAttemptId: "b",
        provider: "microsoft" as const,
        providerEventId: "e",
        providerCalendarId: "c",
        startUtc: "",
        endUtc: "",
        localStart: "",
        localEnd: "",
        timezone: CONFIG.timezone,
        customerName: "A",
        serviceId: "s",
        confirmedAt: NOW.toISOString(),
        offerSetId: "o",
        slotId: "sl",
        schedulingGeneration: 1,
      },
    },
  };
  booked = startOperation(booked, { operationId: "b", type: "BOOK_APPOINTMENT" });
  booked = transitionOperation(booked, "b", "SUCCEEDED");
  const bookedSnap = planAgentState(booked, CONFIG);
  assert.ok(bookedSnap.allowedClaims.includes("CLAIM_BOOKED"));

  let unk = startOperation(ctx, { operationId: "u", type: "BOOK_APPOINTMENT" });
  unk = transitionOperation(unk, "u", "OUTCOME_UNKNOWN");
  const unkSnap = planAgentState(unk, CONFIG);
  assert.ok(unkSnap.forbiddenClaims.includes("CLAIM_BOOKED"));

  console.log("VOICE_V3_AGENT_CLAIMS_PASS");
}

main();
