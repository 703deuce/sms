/**
 * Voice V3 capability-tool surface + delegation handler wiring (no network).
 */
import assert from "node:assert/strict";
import { buildVoiceV3AstraDelegationResponses } from "../src/lib/voice-v3/intake/delegation-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
  getVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import {
  clearDelegatedVoiceToolSessionState,
  handleDelegatedVoiceToolCall,
} from "../src/lib/voice-v3/tools/handle-delegated-voice-tools";
import { voiceV3UsesCapabilityTools } from "../src/lib/voice-v3/intake/tool-surface";

async function main() {
  assert.equal(voiceV3UsesCapabilityTools(), true);

  const delegation = buildVoiceV3AstraDelegationResponses("test", VOICE_V3_BOOKING_AGENT_CONFIG);
  const names = (delegation.tools ?? []).map((t) => String((t as { name?: string }).name));
  assert.deepEqual(names.sort(), ["book_appointment", "find_availability", "update_intake"].sort());

  clearVoiceV3CallRuntimeStore();
  const liveSessionId = "live_tool_arch";
  createVoiceV3CallRuntime({ liveSessionId, callId: "call_tool_arch" });

  const sent: { type: string }[] = [];
  const send = (event: { type: string }) => {
    sent.push(event);
  };

  const nested = {
    type: "response.output_item.done",
    response_id: "resp_1",
    item: {
      type: "function_call",
      name: "update_intake",
      call_id: "fc_update_1",
      arguments: JSON.stringify({ name: "Anthony" }),
    },
  };

  const handled = await handleDelegatedVoiceToolCall({
    liveSessionId,
    nested,
    send,
    delegationId: "del_1",
  });
  assert.equal(handled, true);
  assert.equal(getVoiceV3CallRuntime(liveSessionId)!.getSnapshot().intake.values.name?.value, "Anthony");

  const outputs = sent.filter((e) => e.type === "response.item.create");
  assert.equal(outputs.length, 1);
  const continuations = sent.filter((e) => e.type === "response.create");
  assert.equal(continuations.length, 1);

  await handleDelegatedVoiceToolCall({
    liveSessionId,
    nested,
    send,
    delegationId: "del_1",
  });
  assert.equal(sent.filter((e) => e.type === "response.item.create").length, 1);

  clearDelegatedVoiceToolSessionState(liveSessionId);
  clearVoiceV3CallRuntimeStore();
  console.log("PASS voice-v3 tool architecture");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
