#!/usr/bin/env npx tsx
/**
 * Restore Amy workflow tool_ids + attach Voice V2 shared tools (merge, never replace-only).
 */
import { getPrisma } from "../src/lib/db";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { syncConversationWorkflowToTelnyx } from "../src/lib/voice/telnyx/workflow-sync";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { mergeVoiceV2ToolIds, resolveVoiceV2SharedToolIds } from "../src/lib/voice/telnyx/voice-v2-shared-tools";
import { isVoiceV2PstnLiveBookingMode } from "../src/lib/voice-receptionist-wizard/pstn-workflow-mode";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

export async function restoreAmyTelnyxWorkflowWithV2() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent?.telnyxAssistantId) throw new Error("assistant missing");

  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const config = parseVoiceAgentConfig(runtime || agent.draftConfig);
  const draftAdv = (parseVoiceAgentConfig(agent.draftConfig).advanced || {}) as Record<
    string,
    unknown
  >;
  if (draftAdv.voiceV2PstnLiveBooking === true) {
    config.advanced = {
      ...((config.advanced || {}) as Record<string, unknown>),
      voiceV2PstnLiveBooking: true,
      conversationWorkflowMode: true,
    };
  }
  const synced = await syncConversationWorkflowToTelnyx({
    assistantId: agent.telnyxAssistantId,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    config,
  });
  if (!synced.ok) throw new Error(synced.error || "workflow_sync_failed");

  const v2 = await resolveVoiceV2SharedToolIds();
  const v2Pstn = isVoiceV2PstnLiveBookingMode(config);
  if (v2.findId && v2.bookId && v2.saveIntakeId) {
    const toolIds = mergeVoiceV2ToolIds(synced.toolIds || [], v2);
    await ai.updateAssistant(agent.telnyxAssistantId, { tool_ids: toolIds, tools: [] });
    console.log("Merged tool_ids:", toolIds.join(", "));
    if (v2Pstn) console.log("voiceV2PstnLiveBooking workflow active on n_live_booking");
  } else {
    console.log("V2 shared tools not found — workflow tools only:", synced.toolIds?.join(", "));
  }
}

restoreAmyTelnyxWorkflowWithV2().catch((err) => {
  console.error(err);
  process.exit(1);
});
