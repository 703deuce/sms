import assert from "node:assert/strict";
import { clearVoiceV3CallRuntimeStore, createVoiceV3CallRuntime } from "../src/lib/voice-v3/state/call-runtime";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import {
  attemptSemanticExtractionRetry,
  clearSemanticExtractionRetryState,
  setSemanticExtractionRetryRunnerForTests,
} from "../src/lib/voice-v3/intake/semantic-extraction-retry";
import { setCallerUtteranceForTests } from "./voice-v3-test-helpers";

const NOW = new Date("2026-09-17T15:00:00.000Z");

function fridayAfternoonMeaning(): CallerMeaning {
  return {
    active_goal: "BOOK_APPOINTMENT",
    captured_fields: [],
    scheduling: {
      date_relation: "NEXT_WEEKDAY",
      weekday: "FRIDAY",
      date_expression: "next Friday",
      explicit_date: null,
      time_expression: "afternoon",
      time_kind: "DAYPART",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: "AFTERNOON",
    },
    slot_selection: emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: "NONE",
    corrections: [],
    ambiguities: [],
  };
}

async function main() {
  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: "live_sem_retry",
    callId: "call_sem_retry",
    config: {
      ...VOICE_V3_BOOKING_TEST_CONFIG,
      calendar: { ...VOICE_V3_BOOKING_TEST_CONFIG.calendar!, connectionId: "" },
    },
    now: NOW,
  });

  setCallerUtteranceForTests("live_sem_retry", "Anything Friday afternoon?");
  clearSemanticExtractionRetryState("live_sem_retry");

  let runnerCalls = 0;
  setSemanticExtractionRetryRunnerForTests(async () => {
    runnerCalls += 1;
    return fridayAfternoonMeaning();
  });

  const nested = {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      id: "fc_test_empty",
      response_id: "resp_sem_retry_1",
      name: "emit_caller_meaning",
      arguments: JSON.stringify({
        active_goal: "UNKNOWN",
        captured_fields: [],
        scheduling: emptySchedulingMeaning(),
        slot_selection: emptySlotSelectionMeaning(),
        post_book_intent: "NONE",
        appointment_selection: { selection_type: "NONE", ordinal: null },
        cancellation_confirmation: "NONE",
        corrections: [],
        ambiguities: [],
      }),
    },
  };

  const result = await attemptSemanticExtractionRetry({
    liveSessionId: "live_sem_retry",
    nested,
    priorArgumentsJson: (nested.item as { arguments: string }).arguments,
    runtime,
    send: () => {},
  });

  assert.equal(result.applied, true);
  assert.equal(runnerCalls, 1);

  const ctx = runtime.getSnapshot();
  assert.equal(ctx.dialog.activeGoal, "BOOK_APPOINTMENT");
  assert.equal(ctx.scheduling.meaning?.daypart, "AFTERNOON");

  const rules = evaluateVoiceV3Rules(ctx, runtime.config);
  assert.equal(rules.mayFindAvailability, false);
  assert.equal(rules.hasSchedulingPreference, true);
  assert.equal(ctx.dialog.activeGoal, "BOOK_APPOINTMENT");

  const second = await attemptSemanticExtractionRetry({
    liveSessionId: "live_sem_retry",
    nested,
    priorArgumentsJson: null,
    runtime,
    send: () => {},
  });
  assert.equal(second.applied, false);
  assert.equal(runnerCalls, 1);

  setSemanticExtractionRetryRunnerForTests(null);
  console.log("PASS voice-v3 semantic extraction retry");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
