import assert from "node:assert/strict";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import { transitionOperation, startOperation } from "../src/lib/voice-v3/operations/registry";
import { applyFindAvailabilityResult } from "../src/lib/voice-v3/calendar/find-dispatch";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { assertVoiceV3RuntimeInvariants, VoiceV3InvariantViolation } from "../src/lib/voice-v3/agent/runtime-invariants";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function baseCtx() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "found_call",
    liveSessionId: "found_live",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function meaning(partial: Partial<CallerMeaning>): CallerMeaning {
  return {
    active_goal: partial.active_goal ?? "UNKNOWN",
    goals: partial.goals ?? [],
    captured_fields: partial.captured_fields ?? [],
    scheduling: partial.scheduling ?? emptySchedulingMeaning(),
    slot_selection: partial.slot_selection ?? emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: "NONE",
    corrections: partial.corrections ?? [],
    ambiguities: partial.ambiguities ?? [],
  };
}

function fridayAfternoon() {
  return {
    date_relation: "NEXT_WEEKDAY" as const,
    weekday: "FRIDAY" as const,
    date_expression: "next Friday",
    explicit_date: null,
    time_expression: "afternoon",
    time_kind: "DAYPART" as const,
    exact_time: null,
    start_time: null,
    end_time: null,
    daypart: "AFTERNOON" as const,
  };
}

function main() {
  // Multi-goal single turn
  let ctx = baseCtx();
  ctx = applyCallerMeaningToContext(
    ctx,
    CONFIG,
    meaning({
      goals: [
        { type: "CANCEL_APPOINTMENT", disposition: "START" },
        { type: "BOOK_APPOINTMENT", disposition: "START" },
      ],
      scheduling: fridayAfternoon(),
    }),
    NOW,
  ).context;
  const gm = ctx.conversation!.goalManager;
  assert.equal(gm.pendingGoalIds.length, 1);
  assert.ok(gm.activeGoalId);
  assert.equal(gm.goals[gm.activeGoalId!].type, "CANCEL_APPOINTMENT");
  const pending = gm.goals[gm.pendingGoalIds[0]!];
  assert.equal(pending.type, "BOOK_APPOINTMENT");

  // Stale FIND operation
  ctx = baseCtx();
  ctx = startOperation(ctx, {
    operationId: "find_stale",
    type: "FIND_AVAILABILITY",
    schedulingGeneration: 1,
  });
  ctx = { ...ctx, scheduling: { ...ctx.scheduling, generation: 2 } };
  ctx = transitionOperation(ctx, "find_stale", "STALE");
  assert.equal(ctx.operations.find_stale.status, "STALE");

  // FIND result stale does not apply offer when generation moved
  ctx = baseCtx();
  ctx = {
    ...ctx,
    scheduling: { ...ctx.scheduling, generation: 2 },
    availability: { ...ctx.availability, inFlightGeneration: 1, status: "pending" },
  };
  const staleApply = applyFindAvailabilityResult(ctx, {
    schedulingGeneration: 1,
    offerSet: null,
    failure: null,
    requestKey: "k1",
  });
  assert.equal(staleApply.scheduling.generation, 2);

  // Claims: checking only when FIND running in registry
  ctx = baseCtx();
  ctx = startOperation(ctx, { operationId: "find_run", type: "FIND_AVAILABILITY" });
  const snapRun = planAgentState(ctx, CONFIG);
  assert.ok(snapRun.allowedClaims.includes("CLAIM_CHECKING_AVAILABILITY"));

  // Invariant violation detection
  try {
    assertVoiceV3RuntimeInvariants(
      {
        ...baseCtx(),
        booking: { ...baseCtx().booking, phase: "BOOKING_CONFIRMED", confirmed: null },
      },
      { throwOnViolation: true },
    );
    assert.fail("expected invariant throw");
  } catch (e) {
    assert.ok(e instanceof VoiceV3InvariantViolation);
  }

  console.log("VOICE_V3_AGENT_FOUNDATION_PASS");
}

main();
