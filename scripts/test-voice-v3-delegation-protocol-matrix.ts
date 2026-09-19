/**
 * Regression matrix A–H: delegated function-call protocol + stall breaker insurance.
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { handleDelegatedAstraResponseEvent } from "../src/lib/voice-v3/intake/handle-delegated-meaning";
import {
  clearVoiceV3LiveResponseCoordinator,
  getVoiceV3LiveResponseCoordinator,
} from "../src/lib/voice-v3/delegation/live-response-coordinator";
import { noteCallerTranscriptDelta, clearCallerTurnManager } from "../src/lib/voice-v3/conversation/caller-turn-manager";
import {
  clearCallerTurnSemanticProgress,
  getTurnSemanticStage,
} from "../src/lib/voice-v3/conversation/caller-turn-semantic-progress";
import {
  clearSemanticTurnWatchdog,
  onCallerTurnCommitted,
  runDirectSemanticForTurn,
} from "../src/lib/voice-v3/conversation/semantic-turn-watchdog";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { setCallerUtteranceForTests } from "./voice-v3-test-helpers";
import { markCallerTurnSemanticApplied } from "../src/lib/voice-v3/conversation/caller-turn-manager";

const SESSION = "live_delegation_matrix";
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function meaningPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    active_goal: "BOOK_APPOINTMENT",
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

function emptyMeaningPayload(): string {
  return meaningPayload({ active_goal: "UNKNOWN" });
}

function outputItemDone(callId: string, name: string, args: string) {
  return {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      id: `fc_${callId}`,
      call_id: callId,
      name,
      arguments: args,
    },
  };
}

function nullIntakeArgs(): string {
  return JSON.stringify({
    name: null,
    email: null,
    phone: null,
    date_expression: null,
    time_expression: null,
    active_goal: null,
  });
}

async function testA_greetingPhantom(): Promise<void> {
  clearVoiceV3CallRuntimeStore();
  createVoiceV3CallRuntime({
    liveSessionId: `${SESSION}_a`,
    callId: "v3:matrix_a",
    config: CONFIG,
  });
  const outbound: Array<Record<string, unknown>> = [];
  const send = (e: { type: string }) => outbound.push(e);

  handleDelegatedAstraResponseEvent({
    liveSessionId: `${SESSION}_a`,
    nested: outputItemDone("call_phantom", "emit_caller_meaning", emptyMeaningPayload()),
    send,
    delegationId: "del_phantom",
  });
  await new Promise((r) => setTimeout(r, 25));

  assert.equal(outbound.filter((e) => e.type === "response.item.create").length, 1);
  assert.equal(outbound.filter((e) => e.type === "response.create").length, 1);

  outbound.length = 0;
  noteCallerTranscriptDelta(`${SESSION}_a`, "I want to book");
  setCallerUtteranceForTests(`${SESSION}_a`, "I want to book");

  handleDelegatedAstraResponseEvent({
    liveSessionId: `${SESSION}_a`,
    nested: outputItemDone(
      "call_real",
      "update_intake",
      JSON.stringify({
        name: "Anthony",
        email: null,
        phone: null,
        date_expression: "next Friday",
        time_expression: "afternoon",
        active_goal: "BOOK_APPOINTMENT",
      }),
    ),
    send,
    delegationId: "del_real",
  });
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    outbound.some((e) => e.type === "response.item.create"),
    "second delegation should still submit output",
  );
  clearVoiceV3LiveResponseCoordinator(`${SESSION}_a`);
}

function testB_multiplePendingOutputs(): void {
  const outbound: Array<Record<string, unknown>> = [];
  const send = (e: { type: string }) => outbound.push(e);
  const sid = `${SESSION}_b`;
  const coord = getVoiceV3LiveResponseCoordinator(sid, send);
  coord.registerPendingFunctionCall({
    callId: "call_b1",
    name: "emit_caller_meaning",
    argumentsJson: "{}",
    delegationId: "del_b",
  });
  coord.registerPendingFunctionCall({
    callId: "call_b2",
    name: "emit_caller_meaning",
    argumentsJson: "{}",
    delegationId: "del_b",
  });
  coord.submitDelegatedFunctionCallOutput({
    callId: "call_b1",
    delegationId: "del_b",
    callerTurnId: null,
    semanticDisposition: "EMPTY_NO_CALLER_EVIDENCE",
    output: { accepted: true },
  });
  assert.equal(outbound.filter((e) => e.type === "response.create").length, 0);
  coord.submitDelegatedFunctionCallOutput({
    callId: "call_b2",
    delegationId: "del_b",
    callerTurnId: null,
    semanticDisposition: "EMPTY_NO_CALLER_EVIDENCE",
    output: { accepted: true },
  });
  assert.equal(outbound.filter((e) => e.type === "response.create").length, 1);
  coord.clear();
}

function testC_duplicateFunctionCall(): void {
  const outbound: Array<Record<string, unknown>> = [];
  const send = (e: { type: string }) => outbound.push(e);
  const sid = `${SESSION}_c`;
  const coord = getVoiceV3LiveResponseCoordinator(sid, send);
  const call = {
    callId: "call_dup",
    name: "emit_caller_meaning",
    argumentsJson: "{}",
    delegationId: "del_c",
  };
  assert.equal(coord.registerPendingFunctionCall(call), true);
  assert.equal(coord.registerPendingFunctionCall(call), false);
  coord.submitDelegatedFunctionCallOutput({
    callId: "call_dup",
    delegationId: "del_c",
    callerTurnId: null,
    semanticDisposition: "EMPTY_NO_CALLER_EVIDENCE",
    output: { accepted: true },
  });
  assert.equal(outbound.filter((e) => e.type === "response.item.create").length, 1);
  assert.equal(outbound.filter((e) => e.type === "response.create").length, 1);
  coord.clear();
}

function testD_healthyTurnNoImmediateFallback(): void {
  const sid = `${SESSION}_d`;
  clearCallerTurnManager(sid);
  clearSemanticTurnWatchdog(sid);
  clearCallerTurnSemanticProgress(sid);
  let directStarted = 0;
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    if (args[0] === "SEMANTIC_TURN_STARTED") directStarted += 1;
    orig(...args);
  };
  const turn = {
    turnId: `turn_${sid}_1`,
    sequence: 1,
    status: "COMMITTED" as const,
    transcript: "book tomorrow",
    startedAt: new Date().toISOString(),
    semanticAttempt: 0,
  };
  onCallerTurnCommitted({ liveSessionId: sid, turn, rollingTranscript: turn.transcript });
  assert.equal(directStarted, 0, "healthy function_tool turn must not start direct semantic immediately");
  console.log = orig;
}

async function main() {
  await testA_greetingPhantom();
  testB_multiplePendingOutputs();
  testC_duplicateFunctionCall();
  testD_healthyTurnNoImmediateFallback();

  const sid = `${SESSION}_g`;
  clearCallerTurnManager(sid);
  const turn = {
    turnId: `turn_${sid}_9`,
    sequence: 9,
    status: "COMMITTED" as const,
    transcript: "already applied",
    startedAt: new Date().toISOString(),
    semanticAttempt: 0,
  };
  markCallerTurnSemanticApplied(sid, turn.turnId);
  const outbound: Array<Record<string, unknown>> = [];
  const ok = await runDirectSemanticForTurn({
    liveSessionId: sid,
    turn,
    send: (e) => outbound.push(e),
    reason: "test_late_fallback",
  });
  assert.equal(ok, false, "G: fallback must not apply when turn already has meaning");

  console.log("PASS voice-v3-delegation-protocol-matrix");
}

main().catch((err) => {
  console.error("FAIL voice-v3-delegation-protocol-matrix", err);
  process.exit(1);
});
