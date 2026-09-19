/**
 * Voice V3 delegated capability-tool transport (no Live network).
 */
import assert from "node:assert/strict";
import { buildBasicLiveSessionAcceptParams } from "../src/lib/voice-v3-basic/live-session-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import {
  assertLiveDelegationAcceptPayloadCompatible,
  buildVoiceV3AstraDelegationResponses,
} from "../src/lib/voice-v3/intake/delegation-config";
import { buildUpdateIntakeOpenAiTool } from "../src/lib/voice-v3/tools/update-intake-tool";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
  getVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { handleDelegatedAstraResponseEvent } from "../src/lib/voice-v3/intake/handle-delegated-meaning";
import { clearVoiceV3LiveResponseCoordinator } from "../src/lib/voice-v3/delegation/live-response-coordinator";

const SESSION = "live_transport";

async function main() {
  delete process.env.VOICE_V3_INTAKE_TRANSPORT;

  const accept = buildBasicLiveSessionAcceptParams();
  const responses =
    accept.session.delegation?.type === "responses"
      ? accept.session.delegation.responses
      : null;
  assert.ok(responses);
  assertLiveDelegationAcceptPayloadCompatible(responses);
  const serialized = JSON.stringify(responses);
  assert.equal(serialized.includes('"format"'), false);
  assert.equal(serialized.includes("emit_caller_meaning"), false);

  const toolNames = (responses.tools ?? [])
    .map((t) => (t && typeof t === "object" && "name" in t ? String(t.name) : ""))
    .filter(Boolean);
  assert.ok(toolNames.includes("update_intake"));
  assert.ok(toolNames.includes("find_availability"));
  assert.equal(responses.tool_choice, "auto");
  assert.equal(responses.parallel_tool_calls, true);

  const updateTool = buildUpdateIntakeOpenAiTool(VOICE_V3_BOOKING_AGENT_CONFIG);
  assert.equal(updateTool.name, "update_intake");
  assert.equal(updateTool.strict, true);

  const delegation = buildVoiceV3AstraDelegationResponses("test", VOICE_V3_BOOKING_AGENT_CONFIG);
  assert.equal(JSON.stringify(delegation.tools).includes("emit_caller_meaning"), false);

  clearVoiceV3CallRuntimeStore();
  createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "call_t",
    config: VOICE_V3_BOOKING_AGENT_CONFIG,
  });
  const outbound: Array<Record<string, unknown>> = [];
  const send = (e: { type: string }) => outbound.push(e);

  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        id: "fc_1",
        call_id: "call_update_1",
        name: "update_intake",
        arguments: JSON.stringify({
          name: "Anthony",
          email: null,
          phone: null,
          date_expression: null,
          time_expression: null,
          active_goal: "GENERAL",
        }),
      },
    },
    send,
    delegationId: "del_1",
  });

  await new Promise((r) => setTimeout(r, 50));
  const runtime = getVoiceV3CallRuntime(SESSION);
  assert.ok(runtime);
  assert.equal(runtime.getSnapshot().intake.values.name?.value, "Anthony");
  assert.ok(outbound.some((e) => e.type === "response.item.create"));
  clearVoiceV3LiveResponseCoordinator(SESSION);
  console.log("PASS voice-v3 intake transport (capability tools)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
