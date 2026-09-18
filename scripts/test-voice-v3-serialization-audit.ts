#!/usr/bin/env tsx
/**
 * Serialization audit: function_tool primary path must not schedule delegation_drained / 1.2s direct semantic.
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { handleDelegatedAstraResponseEvent } from "../src/lib/voice-v3/intake/handle-delegated-meaning";
import { clearVoiceV3LiveResponseCoordinator } from "../src/lib/voice-v3/delegation/live-response-coordinator";
import {
  clearSemanticTurnWatchdog,
  drainQueuedSemanticTurns,
} from "../src/lib/voice-v3/conversation/semantic-turn-watchdog";
import {
  clearCallerTurnManager,
  getCallerTurns,
} from "../src/lib/voice-v3/conversation/caller-turn-manager";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { setCallerUtteranceForTests } from "./voice-v3-test-helpers";
import { clearSemanticExtractionRetryState } from "../src/lib/voice-v3/intake/semantic-extraction-retry";

const SESSION = "live_serialization_audit";
const NOW = new Date("2026-09-18T20:00:00.000Z");

function meaningArgs(): string {
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
  });
}

async function testNoDirectDeferOnFunctionTool(): Promise<void> {
  process.env.VOICE_V3_INTAKE_TRANSPORT = "function_tool";
  clearVoiceV3CallRuntimeStore();
  clearCallerTurnManager(SESSION);
  clearSemanticTurnWatchdog(SESSION);
  createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "v3:serialization",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
    now: NOW,
  });

  setCallerUtteranceForTests(SESSION, "I want to book");
  const turn = getCallerTurns(SESSION).at(-1);
  assert.ok(turn);

  await new Promise((r) => setTimeout(r, 1_350));
  assert.equal(
    turn!.status,
    "COMMITTED",
    "function_tool path must not run direct semantic apply on committed turn",
  );
}

async function testNoDelegationDrainedOnFunctionTool(): Promise<void> {
  process.env.VOICE_V3_INTAKE_TRANSPORT = "function_tool";
  clearVoiceV3CallRuntimeStore();
  clearCallerTurnManager(SESSION);
  clearSemanticTurnWatchdog(SESSION);
  clearSemanticExtractionRetryState(SESSION);
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "v3:serialization_drain",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
    now: NOW,
  });
  setCallerUtteranceForTests(SESSION, "book Friday afternoon");

  setCallerUtteranceForTests(SESSION, "book Friday afternoon");
  const turn = getCallerTurns(SESSION).at(-1);
  assert.ok(turn);

  const outbound: Array<Record<string, unknown>> = [];
  const send = (event: { type: string; [key: string]: unknown }) => {
    outbound.push(event);
  };

  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        id: "fc_audit",
        call_id: "call_audit",
        name: "emit_caller_meaning",
        arguments: meaningArgs(),
      },
    },
    send,
    delegationId: "del_audit",
  });

  drainQueuedSemanticTurns({ liveSessionId: SESSION, send });
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(
    turn.status,
    "SEMANTIC_APPLIED",
    "delegation apply should mark turn applied without delegation_drained retry",
  );
  assert.ok(runtime.getSnapshot().dialog.activeGoal === "BOOK_APPOINTMENT");
  clearVoiceV3LiveResponseCoordinator(SESSION);
}

async function main(): Promise<void> {
  await testNoDirectDeferOnFunctionTool();
  await testNoDelegationDrainedOnFunctionTool();
  console.log("PASS voice-v3-serialization-audit");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
