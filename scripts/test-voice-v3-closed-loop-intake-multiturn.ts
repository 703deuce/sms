/**
 * Multi-turn intake: each caller answer must reach authoritative runtime via direct semantic path.
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import {
  noteCallerTranscriptDelta,
  forceCommitCallerTurn,
  clearCallerTurnManager,
} from "../src/lib/voice-v3/conversation/caller-turn-manager";
import { setDirectCallerMeaningExtractionRunnerForTests } from "../src/lib/voice-v3/intake/direct-caller-meaning-extraction";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { runDirectSemanticForTurn } from "../src/lib/voice-v3/conversation/semantic-turn-watchdog";

const NOW = new Date("2026-09-18T16:00:00.000Z");
const SESSION = "closed_loop_multi";
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function meaning(partial: Partial<CallerMeaning>): CallerMeaning {
  return {
    active_goal: partial.active_goal ?? "BOOK_APPOINTMENT",
    goals: partial.goals ?? [],
    captured_fields: partial.captured_fields ?? [],
    scheduling: partial.scheduling ?? emptySchedulingMeaning(),
    slot_selection: partial.slot_selection ?? emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: partial.appointment_selection ?? { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: "NONE",
    corrections: partial.corrections ?? [],
    ambiguities: partial.ambiguities ?? [],
  };
}

async function simulateTurn(
  runtime: ReturnType<typeof createVoiceV3CallRuntime>,
  utterance: string,
  mockMeaning: CallerMeaning,
  outbound: Array<Record<string, unknown>>,
): Promise<void> {
  setDirectCallerMeaningExtractionRunnerForTests(async () => mockMeaning);
  noteCallerTranscriptDelta(SESSION, utterance);
  const turn = forceCommitCallerTurn(SESSION);
  assert.ok(turn, `turn committed for: ${utterance}`);
  const send = (event: { type: string; [key: string]: unknown }) => {
    outbound.push(event);
  };
  const ok = await runDirectSemanticForTurn({
    liveSessionId: SESSION,
    turn,
    send,
    reason: "test",
  });
  assert.equal(ok, true, `semantic applied for: ${utterance}`);
}

async function main() {
  clearVoiceV3CallRuntimeStore();
  clearCallerTurnManager(SESSION);
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "v3:closed_loop_multi",
    config: CONFIG,
    now: NOW,
  });
  const outbound: Array<Record<string, unknown>> = [];

  await simulateTurn(
    runtime,
    "I need to book an appointment",
    meaning({ active_goal: "BOOK_APPOINTMENT" }),
    outbound,
  );
  assert.equal(runtime.getSnapshot().dialog.activeGoal, "BOOK_APPOINTMENT");

  await simulateTurn(
    runtime,
    "Anthony",
    meaning({ captured_fields: [{ key: "name", value: "Anthony", confidence: 0.95 }] }),
    outbound,
  );
  assert.equal(runtime.getSnapshot().intake.values.name?.value, "Anthony");

  await simulateTurn(
    runtime,
    "anthony@example.com",
    meaning({ captured_fields: [{ key: "email", value: "anthony@example.com", confidence: 0.95 }] }),
    outbound,
  );
  assert.equal(runtime.getSnapshot().intake.values.email?.value, "anthony@example.com");

  await simulateTurn(
    runtime,
    "Friday afternoon",
    meaning({
      scheduling: {
        ...emptySchedulingMeaning(),
        date_relation: "NEXT_WEEKDAY",
        weekday: "FRIDAY",
        date_expression: "Friday",
        time_expression: "afternoon",
        time_kind: "DAYPART",
        daypart: "AFTERNOON",
      },
    }),
    outbound,
  );
  assert.equal(runtime.getSnapshot().scheduling.meaning?.weekday, "FRIDAY");

  const snap = planAgentState(runtime.getSnapshot(), CONFIG);
  assert.notEqual(snap.nextConversationAction.type, "NONE");

  const commentaries = outbound.filter((e) => e.type === "session.commentary.append");
  assert.ok(commentaries.length >= 1, "planner should queue commentary for speak actions");

  setDirectCallerMeaningExtractionRunnerForTests(null);
  console.log("test-voice-v3-closed-loop-intake-multiturn: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
