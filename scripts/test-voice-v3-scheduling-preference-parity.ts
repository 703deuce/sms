/**
 * CallerMeaning scheduling path vs set_scheduling_preference tool path must normalize identically.
 */
import assert from "node:assert/strict";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { emptyAppointmentSelectionMeaning } from "../src/lib/voice-v3/intake/appointment-selection-schema";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { mergeSchedulingMeaningIntoContext } from "../src/lib/voice-v3/intake/merge-scheduling-meaning";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import {
  normalizedSchedulingEquals,
  emptySchedulingMeaning,
  type SchedulingMeaning,
} from "../src/lib/voice-v3/time/scheduling-types";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const TZ = "America/Los_Angeles";
const FROZEN = new Date("2026-09-19T20:00:00.000Z"); // Sat 1pm PT

function baseCtx() {
  const clock = buildVoiceV3CallClock(TZ, FROZEN);
  return createInitialVoiceV3CallContext({
    callId: "parity",
    liveSessionId: "live_parity",
    timezone: TZ,
    clock,
    now: FROZEN,
  });
}

function callerMeaning(scheduling: SchedulingMeaning): CallerMeaning {
  return {
    active_goal: "BOOK_APPOINTMENT",
    goals: [],
    captured_fields: [],
    scheduling,
    corrections: [],
    ambiguities: [],
    slot_selection: emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: emptyAppointmentSelectionMeaning(),
    cancellation_confirmation: "NONE",
  };
}

const FIXTURES: SchedulingMeaning[] = [
  {
    ...emptySchedulingMeaning(),
    date_relation: "THIS_WEEKDAY",
    weekday: "TUESDAY",
    time_kind: "DAYPART",
    daypart: "AFTERNOON",
    date_expression: "Tuesday afternoon",
    time_expression: "afternoon",
  },
  {
    ...emptySchedulingMeaning(),
    date_relation: "TOMORROW",
    time_kind: "EXACT",
    exact_time: "15:00",
    date_expression: "tomorrow",
    time_expression: "at 3",
  },
  {
    ...emptySchedulingMeaning(),
    date_relation: "NEXT_WEEKDAY",
    weekday: "WEDNESDAY",
    time_kind: "DAYPART",
    daypart: "MORNING",
    date_expression: "next Wednesday morning",
    time_expression: "morning",
  },
  {
    ...emptySchedulingMeaning(),
    date_relation: "THIS_WEEKDAY",
    weekday: "TUESDAY",
    time_kind: "EXACT",
    exact_time: "16:00",
    date_expression: "Tuesday around four",
    time_expression: "around four",
  },
  {
    ...emptySchedulingMeaning(),
    date_relation: "TODAY",
    time_kind: "AFTER",
    start_time: "15:00",
    date_expression: "today",
    time_expression: "after 3",
  },
  {
    ...emptySchedulingMeaning(),
    date_relation: "TODAY",
    time_kind: "BEFORE",
    end_time: "12:00",
    date_expression: "today",
    time_expression: "before noon",
  },
  {
    ...emptySchedulingMeaning(),
    date_relation: "TODAY",
    time_kind: "BETWEEN",
    start_time: "14:00",
    end_time: "17:00",
    date_expression: "today",
    time_expression: "between 2 and 5",
  },
  {
    ...emptySchedulingMeaning(),
    date_relation: "EXPLICIT_DATE",
    explicit_date: "2026-10-01",
    time_kind: "ANYTIME",
    date_expression: "October 1",
  },
];

for (const sched of FIXTURES) {
  const ctx0 = baseCtx();
  const legacy = applyCallerMeaningToContext(ctx0, VOICE_V3_BOOKING_TEST_CONFIG, callerMeaning(sched), FROZEN);
  const tool = mergeSchedulingMeaningIntoContext(baseCtx(), sched, FROZEN);
  assert.ok(
    normalizedSchedulingEquals(legacy.context.scheduling.normalized, tool.context.scheduling.normalized),
    `normalization mismatch for ${sched.date_expression ?? sched.date_relation}`,
  );
}

console.log("PASS voice-v3 scheduling preference parity");
