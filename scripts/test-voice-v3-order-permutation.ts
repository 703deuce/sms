import assert from "node:assert/strict";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function baseCtx() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "call_perm",
    liveSessionId: "live_perm",
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

function snapshotAfterSequence(steps: CallerMeaning[]) {
  let ctx = baseCtx();
  for (const step of steps) {
    ctx = applyCallerMeaningToContext(ctx, CONFIG, step, NOW).context;
  }
  return ctx;
}

function assertEquivalentFinal(a: ReturnType<typeof snapshotAfterSequence>, b: ReturnType<typeof snapshotAfterSequence>) {
  assert.equal(a.dialog.activeGoal, b.dialog.activeGoal);
  assert.equal(a.intake.values.name?.value, b.intake.values.name?.value);
  assert.equal(a.intake.values.email?.value, b.intake.values.email?.value);
  assert.equal(a.scheduling.meaning?.daypart, b.scheduling.meaning?.daypart);
  assert.equal(a.scheduling.meaning?.weekday, b.scheduling.meaning?.weekday);
  assert.equal(a.scheduling.generation, b.scheduling.generation);
}

function main() {
  const dateFirst = snapshotAfterSequence([
    meaning({ active_goal: "BOOK_APPOINTMENT", scheduling: fridayAfternoon() }),
    meaning({ captured_fields: [{ key: "name", value: "Anthony", confidence: 0.9 }] }),
    meaning({ captured_fields: [{ key: "email", value: "test@example.com", confidence: 0.9 }] }),
  ]);

  assert.equal(dateFirst.dialog.activeGoal, "BOOK_APPOINTMENT");
  assert.equal(dateFirst.intake.values.name?.value, "Anthony");
  assert.equal(dateFirst.scheduling.meaning?.daypart, "AFTERNOON");
  const rulesDateFirst = evaluateVoiceV3Rules(dateFirst, CONFIG);
  assert.equal(rulesDateFirst.findReady, true);
  assert.equal(rulesDateFirst.bookingReady, false);

  const intakeFirst = snapshotAfterSequence([
    meaning({ captured_fields: [{ key: "name", value: "Anthony", confidence: 0.9 }] }),
    meaning({ captured_fields: [{ key: "email", value: "test@example.com", confidence: 0.9 }] }),
    meaning({ active_goal: "BOOK_APPOINTMENT", scheduling: fridayAfternoon() }),
  ]);

  assertEquivalentFinal(dateFirst, intakeFirst);

  const mixed = snapshotAfterSequence([
    meaning({
      active_goal: "BOOK_APPOINTMENT",
      captured_fields: [{ key: "name", value: "Anthony", confidence: 0.9 }],
      scheduling: fridayAfternoon(),
    }),
  ]);
  assert.equal(mixed.intake.values.name?.value, "Anthony");
  assert.equal(mixed.scheduling.meaning?.weekday, "FRIDAY");

  const corrected = applyCallerMeaningToContext(
    mixed,
    CONFIG,
    meaning({
      scheduling: {
        ...fridayAfternoon(),
        weekday: "THURSDAY",
        date_expression: "Thursday",
        daypart: "MORNING",
        time_expression: "morning",
      },
    }),
    NOW,
  ).context;
  assert.equal(corrected.intake.values.name?.value, "Anthony");
  assert.equal(corrected.scheduling.meaning?.weekday, "THURSDAY");
  assert.equal(corrected.scheduling.meaning?.daypart, "MORNING");
  assert.ok(corrected.scheduling.generation > mixed.scheduling.generation);

  const intakeOnlyUnknownGoal = applyCallerMeaningToContext(
    dateFirst,
    CONFIG,
    meaning({ captured_fields: [{ key: "phone", value: "+15551234567", confidence: 0.9 }] }),
    NOW,
  ).context;
  assert.equal(intakeOnlyUnknownGoal.dialog.activeGoal, "BOOK_APPOINTMENT");
  assert.equal(intakeOnlyUnknownGoal.scheduling.meaning?.daypart, "AFTERNOON");

  console.log("PASS voice-v3 order permutation");
}

main();
