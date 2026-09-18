import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import {
  claimDelegatedAstraResponse,
  clearDelegatedAstraResponseDedup,
  extractDelegatedAstraResponseId,
} from "../src/lib/voice-v3/intake/delegated-response-dedup";
import { EMIT_CALLER_MEANING_TOOL_NAME } from "../src/lib/voice-v3/intake/emit-caller-meaning-tool";
import { extractCallerMeaningFromAstraResponseEvent } from "../src/lib/voice-v3/intake/parse-astra-meaning-response";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";

const SESSION = "live_test_dedup";

function main() {
  clearDelegatedAstraResponseDedup(SESSION);

  const responseId = "resp_abc123";
  const meaningArgs = JSON.stringify({
    active_goal: "BOOK_APPOINTMENT",
    captured_fields: [{ key: "name", value: "Anthony", confidence: 0.9 }],
    scheduling: emptySchedulingMeaning(),
    slot_selection: emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: "NONE",
    corrections: [],
    ambiguities: [],
  });

  const argumentsDone = {
    type: "response.function_call_arguments.done",
    response_id: responseId,
    name: EMIT_CALLER_MEANING_TOOL_NAME,
    arguments: meaningArgs,
  };
  const outputItemDone = {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      id: "fc_item_only_id",
      response_id: responseId,
      name: EMIT_CALLER_MEANING_TOOL_NAME,
    },
  };
  const completed = {
    type: "response.completed",
    response: { id: responseId, output: [] },
  };

  const parsed = extractCallerMeaningFromAstraResponseEvent(argumentsDone, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.ok(parsed?.transport === "function_tool");
  assert.equal(parsed?.meaning.captured_fields[0]?.value, "Anthony");

  assert.equal(extractDelegatedAstraResponseId(argumentsDone), responseId);
  assert.equal(extractDelegatedAstraResponseId(outputItemDone), responseId);
  assert.equal(extractDelegatedAstraResponseId(completed), responseId);

  assert.equal(claimDelegatedAstraResponse(SESSION, argumentsDone), true);
  assert.equal(claimDelegatedAstraResponse(SESSION, outputItemDone), false);
  assert.equal(claimDelegatedAstraResponse(SESSION, completed), false);

  clearDelegatedAstraResponseDedup(SESSION);
  console.log("PASS voice-v3 delegated response dedup");
}

main();
