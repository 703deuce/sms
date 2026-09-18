/**
 * Production regression: semantic failure must close emit_caller_meaning before response.create.
 * Empty meaning without committed caller evidence must not trigger recovery or response.create.
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { handleDelegatedAstraResponseEvent } from "../src/lib/voice-v3/intake/handle-delegated-meaning";
import { clearVoiceV3LiveResponseCoordinator } from "../src/lib/voice-v3/delegation/live-response-coordinator";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import {
  clearSemanticExtractionRetryState,
  setSemanticExtractionRetryRunnerForTests,
} from "../src/lib/voice-v3/intake/semantic-extraction-retry";
import { markGreetingInterrupted } from "../src/lib/voice-v3/greeting/greeting-turn";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { setCallerUtteranceForTests } from "./voice-v3-test-helpers";

const NOW = new Date("2026-09-18T15:37:09.000Z");
const SESSION = "live_protocol_race_test";
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function meaningPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    active_goal: "UNKNOWN",
    captured_fields: [],
    scheduling: emptySchedulingMeaning(),
    slot_selection: emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: "NONE",
    corrections: [],
    ambiguities: [],
    ...overrides,
  });
}

function outputItemDone(callId: string, args: string) {
  return {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      id: `fc_${callId}`,
      call_id: callId,
      name: "emit_caller_meaning",
      arguments: args,
    },
  };
}

async function main() {
  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "v3:protocol_race",
    config: CONFIG,
    now: NOW,
  });

  setSemanticExtractionRetryRunnerForTests(async () => null);
  clearSemanticExtractionRetryState(SESSION);
  markGreetingInterrupted(SESSION, "test_barge_in");

  const outbound: Array<Record<string, unknown>> = [];
  const send = (event: { type: string; [key: string]: unknown }) => {
    outbound.push(event);
  };

  // Phantom greeting: empty meaning, no committed caller turn
  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: outputItemDone("call_prod_regression", meaningPayload()),
    send,
  });

  await new Promise((r) => setTimeout(r, 50));

  const itemCreatesPhantom = outbound.filter((e) => e.type === "response.item.create");
  assert.equal(itemCreatesPhantom.length, 1, "must submit function_call_output for empty ignore");
  assert.equal(
    outbound.filter((e) => e.type === "response.create").length,
    0,
    "no response.create when empty meaning has no caller evidence",
  );
  assert.notEqual(
    runtime.getSnapshot().recovery.active?.code,
    "SEMANTIC_EXTRACTION_FAILED",
  );

  // Real failure: empty meaning with committed caller evidence
  outbound.length = 0;
  setCallerUtteranceForTests(SESSION, "I want to book something");

  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: outputItemDone("call_with_evidence", meaningPayload()),
    send,
  });

  await new Promise((r) => setTimeout(r, 50));

  const creates = outbound.filter((e) => e.type === "response.create");
  const itemCreates = outbound.filter((e) => e.type === "response.item.create");
  assert.equal(itemCreates.length, 1, "must submit exactly one function_call_output");
  assert.ok(
    creates.length >= 1,
    "recovery should request speak after function output when caller evidence exists",
  );

  const firstCreateIndex = outbound.findIndex((e) => e.type === "response.create");
  const firstItemIndex = outbound.findIndex((e) => e.type === "response.item.create");
  assert.ok(
    firstItemIndex >= 0 && firstCreateIndex > firstItemIndex,
    "response.create must not precede function_call_output",
  );

  const snap = runtime.getSnapshot();
  assert.equal(snap.recovery.active?.code, "SEMANTIC_EXTRACTION_FAILED");

  const planned = planAgentState(snap, CONFIG);
  assert.notEqual(planned.nextConversationAction.type, "NONE");
  assert.equal(planned.nextConversationAction.type, "CLARIFY_INTENT");

  // Second successful cycle
  outbound.length = 0;
  const bookArgs = meaningPayload({ active_goal: "BOOK_APPOINTMENT" });

  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: outputItemDone("call_success_2", bookArgs),
    send,
  });
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(runtime.getSnapshot().dialog.activeGoal, "BOOK_APPOINTMENT");

  await new Promise((r) => setTimeout(r, 25));
  outbound.length = 0;

  // Coordinator: pending blocks response.create
  clearVoiceV3LiveResponseCoordinator(SESSION);
  const { VoiceV3LiveResponseCoordinator } = await import(
    "../src/lib/voice-v3/delegation/live-response-coordinator"
  );
  const coord = new VoiceV3LiveResponseCoordinator(SESSION, send);
  coord.registerPendingFunctionCall({
    callId: "call_block",
    name: "emit_caller_meaning",
    argumentsJson: "{}",
    delegationId: "del_1",
    outputSubmitted: false,
  });
  coord.requestResponseCreate({ reason: "blocked" });
  assert.equal(
    outbound.filter((e) => e.type === "response.create").length,
    0,
    "must not response.create while pending",
  );
  coord.submitFunctionCallOutput("call_block", { accepted: false, reason: "test" });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(
    outbound.filter((e) => e.type === "response.create").length,
    1,
    "continuation after output",
  );

  setSemanticExtractionRetryRunnerForTests(null);
  clearVoiceV3LiveResponseCoordinator(SESSION);
  console.log("PASS voice-v3-delegation-protocol-race");
}

main().catch((err) => {
  console.error("FAIL voice-v3-delegation-protocol-race", err);
  process.exit(1);
});
