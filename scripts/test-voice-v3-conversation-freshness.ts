#!/usr/bin/env tsx
/**
 * Conversation freshness orchestration — unit/integration (no Live network).
 */
import assert from "node:assert/strict";
import {
  clearCallerTurnManager,
  noteCallerTranscriptDelta,
} from "../src/lib/voice-v3/conversation/caller-turn-manager";
import { onCallerTurnCommitted } from "../src/lib/voice-v3/conversation/delegation-timing";
import { getCurrentConversationRevision } from "../src/lib/voice-v3/conversation/conversation-revision";
import {
  classifyVoiceToolFreshness,
  shouldBlockStaleToolPreDispatch,
} from "../src/lib/voice-v3/delegation/conversation-freshness";
import {
  clearVoiceV3LiveResponseCoordinator,
  getVoiceV3LiveResponseCoordinator,
} from "../src/lib/voice-v3/delegation/live-response-coordinator";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { executeVoiceTool } from "../src/lib/voice-v3/tools/execute-voice-tool";
import { handleDelegatedVoiceToolCall } from "../src/lib/voice-v3/tools/handle-delegated-voice-tools";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";

const SESSION = "live_conv_fresh_test";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function testToolClassification(): void {
  assert.equal(classifyVoiceToolFreshness("update_intake"), "SHARED_FACT");
  assert.equal(classifyVoiceToolFreshness("set_scheduling_preference"), "SEMANTIC_STEERING");
  assert.equal(classifyVoiceToolFreshness("find_availability"), "READ");
  assert.equal(classifyVoiceToolFreshness("book_appointment"), "COMMITTED_WRITE");
  assert.equal(shouldBlockStaleToolPreDispatch("update_intake", "STALE"), false);
  assert.equal(shouldBlockStaleToolPreDispatch("set_scheduling_preference", "STALE"), true);
  assert.equal(shouldBlockStaleToolPreDispatch("find_availability", "STALE"), false);
}

function testDelegationRevisionSnapshot(): void {
  clearVoiceV3LiveResponseCoordinator(SESSION);
  const sent: { type: string }[] = [];
  const coord = getVoiceV3LiveResponseCoordinator(SESSION, (e) => {
    sent.push(e as { type: string });
  });
  coord.onDelegationCreated({ id: "del_rev_1", response_id: "resp_x", offset_ms: 42 });
  const d = coord.getDelegationRuntime("del_rev_1");
  assert.ok(d);
  assert.equal(d!.semanticFreshness, "FRESH");
  assert.equal(d!.delegationCreatedOffsetMs, 42);
  coord.markDelegationsSemanticallyStale(99);
  assert.equal(d!.semanticFreshness, "STALE");
  assert.equal(coord.isDelegationSemanticallyStale("del_rev_1"), true);
}

async function testTurnCommitMarksDelegationStale(): Promise<void> {
  clearCallerTurnManager(SESSION);
  clearVoiceV3LiveResponseCoordinator(SESSION);
  noteCallerTranscriptDelta(SESSION, "I need to book");
  await sleep(800);
  assert.equal(getCurrentConversationRevision(SESSION), 1);

  const coord = getVoiceV3LiveResponseCoordinator(SESSION, () => {});
  coord.onDelegationCreated({ id: "del_turn", offset_ms: 10 });
  const d = coord.getDelegationRuntime("del_turn")!;
  assert.equal(d.basedOnConversationRevision, 1);

  noteCallerTranscriptDelta(SESSION, " Actually call me back");
  await sleep(900);
  assert.equal(getCurrentConversationRevision(SESSION), 2);
  await sleep(50);
  assert.equal(d.semanticFreshness, "STALE");
}

async function testStaleSchedulingDoesNotSetBookGoal(): Promise<void> {
  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "call_stale_goal",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  const ctx = {
    callId: "call_stale_goal",
    liveSessionId: SESSION,
    delegationId: "del_stale",
    functionCallId: "fc_set_stale",
    runtime,
    tenantId: "tenant",
    sendContext: () => {},
    delegationSemanticallyFresh: false,
    delegationBasedOnConversationRevision: 1,
    currentConversationRevision: 2,
  };
  const before = runtime.getSnapshot().dialog.activeGoal;
  await executeVoiceTool(ctx, "set_scheduling_preference", {
    ...emptySchedulingMeaning(),
    date_relation: "NEXT_WEEKDAY",
    weekday: "MONDAY",
    time_kind: "DAYPART",
    daypart: "MORNING",
    date_expression: "Monday morning",
    time_expression: "morning",
  });
  const after = runtime.getSnapshot().dialog.activeGoal;
  assert.equal(after, before);
}

async function testStaleToolDispatchBlocked(): Promise<void> {
  clearVoiceV3CallRuntimeStore();
  clearVoiceV3LiveResponseCoordinator(SESSION);
  createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "call_block",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  const coord = getVoiceV3LiveResponseCoordinator(SESSION, () => {});
  coord.onDelegationCreated({ id: "del_block" });
  const d = coord.getDelegationRuntime("del_block")!;
  d.basedOnConversationRevision = 1;
  d.semanticFreshness = "STALE";

  const sent: unknown[] = [];
  const send = (e: { type: string }) => {
    sent.push(e);
  };
  getVoiceV3LiveResponseCoordinator(SESSION, send);

  const nested = {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      call_id: "call_block_fc",
      name: "set_scheduling_preference",
      arguments: JSON.stringify({ date_relation: "UNSPECIFIED" }),
    },
  };

  await handleDelegatedVoiceToolCall({
    liveSessionId: SESSION,
    nested,
    send,
    delegationId: "del_block",
  });

  const itemCreate = sent.find(
    (e) => (e as { type: string }).type === "response.item.create",
  ) as { item?: { output?: string } } | undefined;
  assert.ok(itemCreate);
  const parsed = JSON.parse(itemCreate!.item!.output!);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, "SEMANTIC_SUPERSEDED");
}

async function testStaleBookDispatchBlocked(): Promise<void> {
  clearVoiceV3CallRuntimeStore();
  clearVoiceV3LiveResponseCoordinator(SESSION);
  createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "call_block_book",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  const coord = getVoiceV3LiveResponseCoordinator(SESSION, () => {});
  coord.onDelegationCreated({ id: "del_book_stale" });
  const d = coord.getDelegationRuntime("del_book_stale")!;
  d.basedOnConversationRevision = 3;
  d.semanticFreshness = "STALE";

  const sent: unknown[] = [];
  const send = (e: { type: string }) => {
    sent.push(e);
  };
  getVoiceV3LiveResponseCoordinator(SESSION, send);

  await handleDelegatedVoiceToolCall({
    liveSessionId: SESSION,
    nested: {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        call_id: "call_block_book_fc",
        name: "book_appointment",
        arguments: JSON.stringify({ slot_id: "slot_test" }),
      },
    },
    send,
    delegationId: "del_book_stale",
  });

  const itemCreate = sent.find(
    (e) => (e as { type: string }).type === "response.item.create",
  ) as { item?: { output?: string } } | undefined;
  assert.ok(itemCreate);
  const parsed = JSON.parse(itemCreate!.item!.output!);
  assert.equal(parsed.status, "SEMANTIC_SUPERSEDED");
  assert.equal(shouldBlockStaleToolPreDispatch("request_callback", "STALE"), true);
  assert.equal(shouldBlockStaleToolPreDispatch("transfer_call", "STALE"), true);
}

async function main(): Promise<void> {
  testToolClassification();
  testDelegationRevisionSnapshot();
  await testTurnCommitMarksDelegationStale();
  await testStaleSchedulingDoesNotSetBookGoal();
  await testStaleToolDispatchBlocked();
  await testStaleBookDispatchBlocked();
  console.log("VOICE_V3_CONVERSATION_FRESHNESS_TESTS_PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
