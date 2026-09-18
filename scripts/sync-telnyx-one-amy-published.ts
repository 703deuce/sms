#!/usr/bin/env npx tsx
/** Push published v76+ config (compiled prompt + workflow) to Telnyx. */
import { getPrisma } from "../src/lib/db";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { syncTelnyxAssistant } from "../src/lib/voice/telnyx/assistant-sync";
import { syncConversationWorkflowToTelnyx } from "../src/lib/voice/telnyx/workflow-sync";
import { getReceptionistCompiledFromAdvanced } from "../src/lib/voice/receptionist/runtime";
import { AMY_V2_CORE_STATIC_PROMPT } from "../src/lib/voice-receptionist-wizard/one-amy/amy-core-static-prompt";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent?.telnyxAssistantId) throw new Error("agent missing");

  const config = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const snap = getReceptionistCompiledFromAdvanced(config.advanced as Record<string, unknown>);
  console.log("Published snapshot:", {
    oneAmy: snap?.voiceV2OneAmy,
    promptLen: snap?.compiledPrompt?.length,
    exactCore: snap?.compiledPrompt?.startsWith(AMY_V2_CORE_STATIC_PROMPT.slice(0, 80)),
  });

  const sync = await syncTelnyxAssistant(WORKSPACE_ID, agent, config);
  console.log("syncTelnyxAssistant:", sync);

  const workflow = await syncConversationWorkflowToTelnyx({
    assistantId: agent.telnyxAssistantId,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    config,
  });
  console.log("workflow:", workflow.ok ? "ok" : workflow.error);

  const remote = await ai.getAssistant(agent.telnyxAssistantId);
  const data = ((remote as { data?: Record<string, unknown> }).data || remote) as Record<
    string,
    unknown
  >;
  const instr = String(data.instructions || "");
  const flow = data.conversation_flow as { nodes?: Array<{ id: string; shared_tool_ids?: string[] }> };
  const general = flow?.nodes?.find((n) => n.id === "n_general");
  console.log({
    instructionsLen: instr.length,
    instructionsHasAmyCore: instr.includes("FINAL OPERATING PRINCIPLES"),
    generalTools: general?.shared_tool_ids?.length,
    liveBookingNode: flow?.nodes?.some((n) => n.id === "n_live_booking"),
  });

  if (!workflow.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
