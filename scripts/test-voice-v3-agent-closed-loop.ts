/**
 * Closed-loop recovery: blocker → planner action → meaning merge → goal preserved.
 */
import assert from "node:assert/strict";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function baseCtx() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "loop_call",
    liveSessionId: "loop_live",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function meaning(partial: Partial<CallerMeaning>): CallerMeaning {
  return {
    active_goal: partial.active_goal ?? "BOOK_APPOINTMENT",
    goals: partial.goals ?? [],
    captured_fields: partial.captured_fields ?? [],
    scheduling: partial.scheduling ?? emptySchedulingMeaning(),
    slot_selection: partial.slot_selection ?? emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: partial.appointment_selection ?? { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: partial.cancellation_confirmation ?? "NONE",
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

function loopMissingField(fieldKey: string, supplyValue: string) {
  let ctx = baseCtx();
  ctx = applyCallerMeaningToContext(
    ctx,
    CONFIG,
    meaning({ active_goal: "BOOK_APPOINTMENT", scheduling: fridayAfternoon() }),
    NOW,
  ).context;
  let snap = planAgentState(ctx, CONFIG);
  assert.equal(snap.nextConversationAction.type, "ASK_REQUIRED_FIELD");
  assert.equal((snap.nextConversationAction as { fieldKey: string }).fieldKey, fieldKey);

  ctx = applyCallerMeaningToContext(
    ctx,
    CONFIG,
    meaning({
      captured_fields: [{ key: fieldKey, value: supplyValue, confidence: 0.95 }],
    }),
    NOW,
  ).context;
  assert.equal(ctx.intake.values[fieldKey]?.value, supplyValue);
  snap = planAgentState(ctx, CONFIG);
  if (snap.nextConversationAction.type === "ASK_REQUIRED_FIELD") {
    assert.notEqual((snap.nextConversationAction as { fieldKey: string }).fieldKey, fieldKey);
  }
  assert.equal(ctx.dialog.activeGoal, "BOOK_APPOINTMENT");
  assert.equal(ctx.scheduling.meaning?.weekday, "FRIDAY");
}

function main() {
  loopMissingField("name", "Anthony");

  let ctxEmail = baseCtx();
  ctxEmail = applyCallerMeaningToContext(
    ctxEmail,
    CONFIG,
    meaning({
      active_goal: "BOOK_APPOINTMENT",
      scheduling: fridayAfternoon(),
      captured_fields: [{ key: "name", value: "Anthony", confidence: 0.9 }],
    }),
    NOW,
  ).context;
  let snapEmail = planAgentState(ctxEmail, CONFIG);
  assert.equal(snapEmail.nextConversationAction.type, "ASK_REQUIRED_FIELD");
  assert.equal((snapEmail.nextConversationAction as { fieldKey: string }).fieldKey, "email");
  ctxEmail = applyCallerMeaningToContext(
    ctxEmail,
    CONFIG,
    meaning({ captured_fields: [{ key: "email", value: "a@b.co", confidence: 0.9 }] }),
    NOW,
  ).context;
  assert.equal(ctxEmail.intake.values.email?.value, "a@b.co");

  // Ambiguous scheduling → clarify, then resolve
  let ctx = baseCtx();
  ctx = applyCallerMeaningToContext(
    ctx,
    CONFIG,
    meaning({
      scheduling: {
        ...emptySchedulingMeaning(),
        date_relation: "UNSPECIFIED",
        time_kind: "UNSPECIFIED",
        ambiguities: [],
      },
      ambiguities: [{ field: "scheduling", reason: "date unclear" }],
    }),
    NOW,
  ).context;
  let snap = planAgentState(ctx, CONFIG);
  assert.ok(
    snap.nextConversationAction.type === "ASK_SCHEDULING_DATE" ||
      snap.nextConversationAction.type === "CLARIFY_SCHEDULING",
  );
  ctx = applyCallerMeaningToContext(ctx, CONFIG, meaning({ scheduling: fridayAfternoon() }), NOW).context;
  snap = planAgentState(ctx, CONFIG);
  assert.notEqual(snap.nextConversationAction.type, "ASK_SCHEDULING_DATE");

  // Cancellation confirmation loop
  ctx = baseCtx();
  ctx = {
    ...ctx,
    dialog: { activeGoal: "CANCEL_APPOINTMENT" },
    appointmentManagement: {
      ...ctx.appointmentManagement,
      verifiedExisting: {
        internalBookingId: "bk1",
        providerEventId: "evt1",
        providerCalendarId: "cal",
        startUtc: "2026-09-19T17:00:00.000Z",
        endUtc: "2026-09-19T18:00:00.000Z",
        localStart: "2026-09-19T13:00:00-04:00",
        localEnd: "2026-09-19T14:00:00-04:00",
        timezone: CONFIG.timezone,
        customerName: "Anthony",
      },
      cancellation: {
        ...ctx.appointmentManagement.cancellation,
        phase: "CANCELLATION_CONFIRMATION_REQUIRED",
        awaitingConfirmation: true,
      },
    },
  };
  snap = planAgentState(ctx, CONFIG);
  assert.equal(snap.nextConversationAction.type, "CONFIRM_CANCELLATION");
  const afterConfirm = applyCallerMeaningToContext(
    ctx,
    CONFIG,
    meaning({ active_goal: "CANCEL_APPOINTMENT", cancellation_confirmation: "CONFIRM" }),
    NOW,
  ).context;
  assert.equal(afterConfirm.appointmentManagement.lastCancellationConfirmation, "CONFIRM");

  console.log("VOICE_V3_AGENT_CLOSED_LOOP_PASS");
}

main();
