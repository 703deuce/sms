import assert from "node:assert/strict";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { evaluateVoiceV3Recovery } from "../src/lib/voice-v3/recovery/evaluate-recovery";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import { startOperation, transitionOperation } from "../src/lib/voice-v3/operations/registry";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function base() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "fail_call",
    liveSessionId: "fail_live",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function main() {
  // Empty semantic stall → recovery path exists
  let ctx = base();
  const rules = evaluateVoiceV3Rules(ctx, CONFIG);
  const recovery = evaluateVoiceV3Recovery({ ctx, rules, config: CONFIG, now: NOW });
  assert.ok(recovery === null || recovery.code);

  // FIND failed → planner + recovery
  ctx = base();
  ctx = {
    ...ctx,
    availability: {
      ...ctx.availability,
      status: "failed",
      lastFailure: {
        reason: "timeout",
        message: "timeout",
        at: NOW.toISOString(),
        schedulingGeneration: 1,
      },
    },
  };
  const r2 = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
    now: NOW,
  });
  assert.equal(r2?.code, "PROVIDER_TIMEOUT");
  const snap = planAgentState(ctx, CONFIG);
  assert.equal(snap.nextConversationAction.type, "INFORM_TEMPORARY_FAILURE");

  // BOOK outcome unknown
  ctx = base();
  ctx = {
    ...ctx,
    booking: { ...ctx.booking, phase: "BOOKING_OUTCOME_UNKNOWN", lastFailure: { reason: "timeout", message: "x", at: NOW.toISOString() } },
  };
  ctx = startOperation(ctx, { operationId: "book_unk", type: "BOOK_APPOINTMENT" });
  ctx = transitionOperation(ctx, "book_unk", "OUTCOME_UNKNOWN");
  const r3 = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
  });
  assert.equal(r3?.code, "BOOKING_OUTCOME_UNKNOWN");

  // CANCEL outcome unknown phase
  ctx = base();
  ctx = {
    ...ctx,
    appointmentManagement: {
      ...ctx.appointmentManagement,
      cancellation: {
        ...ctx.appointmentManagement.cancellation,
        phase: "CANCELLATION_OUTCOME_UNKNOWN",
      },
    },
  };
  const r4 = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
  });
  assert.ok(r4?.code === "CANCELLATION_OUTCOME_UNKNOWN" || r4?.code === "MICROSOFT_TEMPORARY_FAILURE");

  console.log("VOICE_V3_AGENT_FAILURE_MATRIX_PASS");
}

main();
