/**
 * LiveKit vs sideband delegation tool continuation — architecture contracts (no network).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../lib/server/voice-v3/config/booking-agent-config";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
  getVoiceV3CallRuntime,
} from "../lib/server/voice-v3/state/call-runtime";
import { executeVoiceTool } from "../lib/server/voice-v3/tools/execute-voice-tool";
import { createVoiceV3LiveKitLiveContextCollector } from "../lib/server/voice-v3/livekit/live-context";
import {
  clearDelegatedVoiceToolSessionState,
  handleDelegatedVoiceToolCall,
} from "../lib/server/voice-v3/tools/handle-delegated-voice-tools";

const repoRoot = join(import.meta.dirname, "..", "..");

function assertLiveKitWorkerDoesNotUseNodeSidebandCompletion(): void {
  const sessionPy = readFileSync(
    join(repoRoot, "voice-runtime-python/transovo_voice/voice_v3/session.py"),
    "utf8",
  );
  assert.equal(sessionPy.includes("handleDelegatedVoiceToolCall"), false);
  assert.equal(sessionPy.includes("SidebandWS"), false);
  const gptLive = readFileSync(
    join(
      repoRoot,
      "docs/VOICE-V3-LIVEKIT-MIGRATION-DIRECTIVE.md",
    ),
    "utf8",
  );
  assert.match(gptLive, /no\*\* manual continuation/i);
}

async function testLiveKitExecutorAcceptsDelegationIdForLiveContext(): Promise<void> {
  clearVoiceV3CallRuntimeStore();
  const liveSessionId = "live_deleg_cont_arch";
  const callId = "call_deleg_cont_arch";
  createVoiceV3CallRuntime({
    liveSessionId,
    callId,
    config: { ...VOICE_V3_BOOKING_AGENT_CONFIG, intakeFields: VOICE_V3_BOOKING_AGENT_CONFIG.intakeFields },
  });
  const runtime = getVoiceV3CallRuntime(liveSessionId)!;
  const liveContext = createVoiceV3LiveKitLiveContextCollector();
  const engineResult = await executeVoiceTool(
    {
      callId,
      liveSessionId,
      delegationId: "dlg_scope_1",
      functionCallId: "fc_deleg_scope_1",
      runtime,
      tenantId: "ws_test",
      sendContext: liveContext.sendContext,
    },
    "update_intake",
    { name: "Test Caller" },
  );

  assert.equal(engineResult.ok, true);
  assert.ok(liveContext.events.length > 0);
  assert.ok(
    liveContext.events.some((e) => e.delegation_id === "dlg_scope_1"),
    "intake live context should be delegation-scoped when worker passes delegationId",
  );
  assert.equal(getVoiceV3CallRuntime(liveSessionId)!.getSnapshot().intake.values.name?.value, "Test Caller");
  clearVoiceV3CallRuntimeStore();
}

async function testSidebandPathStillSubmitsContinuation(): Promise<void> {
  clearVoiceV3CallRuntimeStore();
  const liveSessionId = "live_sideband_cont";
  createVoiceV3CallRuntime({ liveSessionId, callId: "call_sideband_cont" });
  const sent: { type: string }[] = [];
  const handled = await handleDelegatedVoiceToolCall({
    liveSessionId,
    nested: {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        name: "update_intake",
        call_id: "fc_sideband_1",
        arguments: JSON.stringify({ name: "Sideband" }),
      },
    },
    send: (e) => sent.push(e),
    delegationId: "dlg_sideband_1",
  });
  assert.equal(handled, true);
  assert.equal(sent.filter((e) => e.type === "response.item.create").length, 1);
  assert.equal(sent.filter((e) => e.type === "response.create").length, 1);
  clearDelegatedVoiceToolSessionState(liveSessionId);
  clearVoiceV3CallRuntimeStore();
}

async function main() {
  assertLiveKitWorkerDoesNotUseNodeSidebandCompletion();
  await testLiveKitExecutorAcceptsDelegationIdForLiveContext();
  await testSidebandPathStillSubmitsContinuation();
  console.log("PASS voice-v3 delegation continuation architecture");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
