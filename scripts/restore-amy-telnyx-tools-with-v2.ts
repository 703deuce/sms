#!/usr/bin/env npx tsx
/**
 * Restore Amy workflow tool_ids + attach Voice V2 shared tools (merge, never replace-only).
 */
import { getPrisma } from "../src/lib/db";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { syncConversationWorkflowToTelnyx } from "../src/lib/voice/telnyx/workflow-sync";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import {
  VOICE_V2_TELNYX_TOOL_NAME,
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
} from "../src/lib/voice-v2/telnyx-tool-definition";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

async function resolveV2ToolIds(): Promise<string[]> {
  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  const findId = tools.find((t) => t.display_name === VOICE_V2_TELNYX_TOOL_NAME)?.id;
  const bookId = tools.find((t) => t.display_name === VOICE_V2_BOOK_TELNYX_TOOL_NAME)?.id;
  return [findId, bookId].filter(Boolean) as string[];
}

export async function restoreAmyTelnyxWorkflowWithV2() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent?.telnyxAssistantId) throw new Error("assistant missing");

  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const config = parseVoiceAgentConfig(runtime || agent.draftConfig);
  const synced = await syncConversationWorkflowToTelnyx({
    assistantId: agent.telnyxAssistantId,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    config,
  });
  if (!synced.ok) throw new Error(synced.error || "workflow_sync_failed");

  const v2Ids = await resolveV2ToolIds();
  if (v2Ids.length) {
    const toolIds = [...new Set([...(synced.toolIds || []), ...v2Ids])];
    await ai.updateAssistant(agent.telnyxAssistantId, { tool_ids: toolIds, tools: [] });
    console.log("Merged tool_ids:", toolIds.join(", "));
  } else {
    console.log("V2 shared tools not found — workflow tools only:", synced.toolIds?.join(", "));
  }
}

restoreAmyTelnyxWorkflowWithV2().catch((err) => {
  console.error(err);
  process.exit(1);
});
