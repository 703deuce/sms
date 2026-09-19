/**
 * Delegated tool protocol: unknown tool still completes output + one continuation.
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { handleDelegatedAstraResponseEvent } from "../src/lib/voice-v3/intake/handle-delegated-meaning";
import { clearVoiceV3LiveResponseCoordinator } from "../src/lib/voice-v3/delegation/live-response-coordinator";
import { setCallerUtteranceForTests } from "./voice-v3-test-helpers";

const SESSION = "live_protocol_race_test";
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

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

async function main() {
  clearVoiceV3CallRuntimeStore();
  createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "v3:protocol_race",
    config: CONFIG,
  });

  const outbound: Array<Record<string, unknown>> = [];
  const send = (event: { type: string }) => outbound.push(event);

  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: outputItemDone("call_unknown", "legacy_emit_caller_meaning", "{}"),
    send,
    delegationId: "del_1",
  });
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(outbound.filter((e) => e.type === "response.item.create").length, 1);
  assert.equal(outbound.filter((e) => e.type === "response.create").length, 1);

  outbound.length = 0;
  setCallerUtteranceForTests(SESSION, "I want to book something");
  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: outputItemDone(
      "call_update",
      "update_intake",
      JSON.stringify({
        name: "Anthony",
        email: null,
        phone: null,
        date_expression: "Friday",
        time_expression: "afternoon",
        active_goal: "BOOK_APPOINTMENT",
      }),
    ),
    send,
    delegationId: "del_2",
  });
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(outbound.some((e) => e.type === "response.item.create"));
  assert.equal(outbound.filter((e) => e.type === "response.create").length, 1);

  clearVoiceV3LiveResponseCoordinator(SESSION);
  console.log("PASS voice-v3-delegation-protocol-race");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
