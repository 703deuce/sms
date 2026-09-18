import assert from "node:assert/strict";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import { assertVoiceV3RuntimeInvariants } from "../src/lib/voice-v3/agent/runtime-invariants";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function baseCtx() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "sim_call",
    liveSessionId: "sim_live",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function meaning(partial: Partial<CallerMeaning>): CallerMeaning {
  return {
    active_goal: partial.active_goal ?? "UNKNOWN",
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

function applyTurn(ctx: ReturnType<typeof baseCtx>, m: CallerMeaning) {
  return applyCallerMeaningToContext(ctx, CONFIG, m, NOW).context;
}

function main() {
  // Volunteered information test
  let ctx = baseCtx();
  ctx = applyTurn(
    ctx,
    meaning({
      active_goal: "UNKNOWN",
      captured_fields: [
        { key: "name", value: "Anthony", confidence: 0.9 },
        { key: "email", value: "anthony@example.com", confidence: 0.9 },
      ],
      scheduling: fridayAfternoon(),
    }),
  );
  assert.equal(ctx.intake.values.name?.value, "Anthony");
  assert.equal(ctx.intake.values.email?.value, "anthony@example.com");
  assert.equal(ctx.dialog.activeGoal, "BOOK_APPOINTMENT");
  const snap = planAgentState(ctx, CONFIG);
  assert.ok(!snap.forbiddenClaims.includes("CLAIM_CHECKING_AVAILABILITY") || snap.activeOperations.length === 0);
  assertVoiceV3RuntimeInvariants(ctx, { throwOnViolation: true });

  // Forgotten-question: slot selected path blocked by missing name — planner asks name
  ctx = baseCtx();
  ctx = applyTurn(ctx, meaning({ active_goal: "BOOK_APPOINTMENT", scheduling: fridayAfternoon() }));
  const rules = evaluateVoiceV3Rules(ctx, CONFIG);
  const snap2 = planAgentState(ctx, CONFIG);
  assert.ok(rules.missingRequiredFields.includes("name"));
  assert.equal(snap2.nextConversationAction.type, "ASK_REQUIRED_FIELD");

  // Goal switch
  ctx = baseCtx();
  ctx = applyTurn(ctx, meaning({ active_goal: "BOOK_APPOINTMENT", scheduling: fridayAfternoon() }));
  ctx = applyTurn(ctx, meaning({ active_goal: "CANCEL_APPOINTMENT" }));
  assert.equal(ctx.dialog.activeGoal, "CANCEL_APPOINTMENT");
  assert.equal(ctx.availability.status, "idle");
  assert.equal(ctx.intake.values.name?.value ?? "", "");

  // Claims: no FIND running => must not allow checking
  ctx = baseCtx();
  const snapIdle = planAgentState(ctx, CONFIG);
  assert.ok(snapIdle.forbiddenClaims.includes("CLAIM_CHECKING_AVAILABILITY"));

  // Correction preserves name
  ctx = baseCtx();
  ctx = applyTurn(ctx, meaning({ captured_fields: [{ key: "name", value: "Anthony", confidence: 0.9 }] }));
  ctx = applyTurn(
    ctx,
    meaning({
      scheduling: {
        ...fridayAfternoon(),
        weekday: "THURSDAY",
        date_expression: "Thursday",
        daypart: "MORNING",
      },
    }),
  );
  assert.equal(ctx.intake.values.name?.value, "Anthony");
  assert.equal(ctx.scheduling.meaning?.weekday, "THURSDAY");

  console.log("VOICE_V3_AGENT_SIMULATOR_PASS");
}

main();
