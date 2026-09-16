#!/usr/bin/env npx tsx
/**
 * Republish + Telnyx workflow sync for one-Amy V2 PSTN (publish + repair workflow).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/republish-one-amy-voice-agent.ts
 */
import { getPrisma } from "../src/lib/db";
import { publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { RECEPTIONIST_COMPILED_KEY } from "../src/lib/voice/receptionist/types";
import { AMY_V2_CORE_STATIC_PROMPT } from "../src/lib/voice-v2/one-amy/amy-core-static-prompt";
import { syncConversationWorkflowToTelnyx } from "../src/lib/voice/telnyx/workflow-sync";
import { readTelnyxWorkflowState } from "../src/lib/voice/telnyx/workflow-readback";
import { verifyVoiceV2WorkflowReadBack } from "../src/lib/voice-v2/workflow-capability";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { syncTelnyxAssistant } from "../src/lib/voice/telnyx/assistant-sync";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    include: { publishedVersion: true },
  });
  if (!agent?.telnyxAssistantId) throw new Error("Agent or Telnyx assistant missing");

  console.log("Publishing (recompile + version)…");
  const built = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, "republish-one-amy-voice-agent");

  const publishedCfg = parseVoiceAgentConfig(built.version.config);
  const snap = (publishedCfg as Record<string, unknown>)[RECEPTIONIST_COMPILED_KEY] as {
    compiledPrompt?: string;
    voiceV2OneAmy?: boolean;
  };
  const prompt = snap?.compiledPrompt || "";
  console.log({
    version: built.version.version,
    voiceV2OneAmy: snap?.voiceV2OneAmy,
    promptBytes: prompt.length,
    exactStaticCore:
      prompt.length >= AMY_V2_CORE_STATIC_PROMPT.length &&
      prompt.startsWith(AMY_V2_CORE_STATIC_PROMPT.slice(0, 80)),
    hasFinalPrinciples: prompt.includes("FINAL OPERATING PRINCIPLES"),
  });

  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  let config = parseVoiceAgentConfig(runtime || publishedCfg);
  const draftAdv = (parseVoiceAgentConfig(agent.draftConfig).advanced || {}) as Record<string, unknown>;
  if (draftAdv.voiceV2PstnLiveBooking === true) {
    config.advanced = {
      ...((config.advanced || {}) as Record<string, unknown>),
      voiceV2PstnLiveBooking: true,
      conversationWorkflowMode: true,
    };
  }

  console.log("\nSyncing Telnyx assistant (instructions + workflow)…");
  const telnyx = await syncTelnyxAssistant({
    workspaceId: WORKSPACE_ID,
    agent: {
      id: agent.id,
      workspaceId: WORKSPACE_ID,
      name: agent.name,
      agentType: agent.agentType,
      purpose: agent.purpose,
      telnyxAssistantId: agent.telnyxAssistantId,
      telnyxConnectionId: agent.telnyxConnectionId,
    },
    config,
  });
  console.log("syncTelnyxAssistant:", telnyx.ok ? "ok" : telnyx.error || "failed");

  console.log("\nWorkflow sync (explicit)…");
  const workflow = await syncConversationWorkflowToTelnyx({
    assistantId: agent.telnyxAssistantId,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    config,
  });

  const readBack = await readTelnyxWorkflowState(agent.telnyxAssistantId);
  const verified = verifyVoiceV2WorkflowReadBack({
    expectedVoiceV2Booking: true,
    readBack,
  });

  console.log(
    JSON.stringify(
      {
        telnyxAssistantId: agent.telnyxAssistantId,
        workflowOk: workflow.ok,
        workflowError: workflow.error,
        verifyOk: verified.ok,
        verifyDetail: verified.ok ? null : (verified as { detail?: string }).detail,
        assistantToolCount: readBack.tool_ids.length,
        generalToolCount: readBack.generalNode?.shared_tool_ids?.length ?? 0,
        liveBookingNode: Boolean(readBack.liveBookingNode),
      },
      null,
      2,
    ),
  );

  if (!workflow.ok || !verified.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
