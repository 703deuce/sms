#!/usr/bin/env tsx
/**
 * Publish-only republish for MCTB Harbor after-hours agent (no draft mutation).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/republish-mctb-voice-agent.ts
 */
import { getPrisma } from "../src/lib/db";
import { publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { syncConversationWorkflowToTelnyx } from "../src/lib/voice/telnyx/workflow-sync";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { telnyxAssistantId: true, draftConfig: true },
  });
  if (!agent?.telnyxAssistantId) throw new Error("Agent or Telnyx assistant missing");

  console.log("Republishing agent version to Telnyx…");
  const built = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, "republish-mctb-voice-agent");

  const config = parseVoiceAgentConfig(built.version.config);
  const workflow = await syncConversationWorkflowToTelnyx({
    assistantId: agent.telnyxAssistantId,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    config,
  });

  console.log(
    JSON.stringify(
      {
        version: built.version.version,
        telnyxAssistantId: built.agent.telnyxAssistantId,
        workflowOk: workflow.ok,
        toolIds: workflow.toolIds,
        workflowNodes: workflow.workflowNodes,
        workflowError: workflow.error,
      },
      null,
      2,
    ),
  );

  if (!workflow.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
