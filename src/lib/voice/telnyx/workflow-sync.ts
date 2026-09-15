/**
 * Push Telnyx Conversation Workflow + shared tool_ids for Amy production.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import * as ai from "./ai-client";
import { buildAmyConversationWorkflow } from "./conversation-workflow";
import { ensureTransovoSharedWorkflowTools } from "./shared-tools";
import { getAgentRagBucketIds } from "../knowledge-processor";
import { isVoiceCanonicalAiBookingPublishMode } from "@/lib/voice/workflow-engine/tool-publish";
import { isVoiceV2PstnLiveBookingMode } from "@/lib/voice-v2/pstn-workflow-mode";
import {
  mergeVoiceV2ToolIds,
  resolveVoiceV2SharedToolIds,
} from "./voice-v2-shared-tools";

export async function syncConversationWorkflowToTelnyx(input: {
  assistantId: string;
  workspaceId: string;
  agentId: string;
  config: VoiceAgentConfig;
  transferTargets?: Array<{ name: string; to: string }>;
}): Promise<{
  ok: boolean;
  toolIds?: string[];
  error?: string;
  workflowNodes?: number;
}> {
  const shared = await ensureTransovoSharedWorkflowTools({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    transferTargets: input.transferTargets,
  });

  const bucketIds = await getAgentRagBucketIds(input.workspaceId, input.agentId);
  const retrievalId = null;

  const canonicalBooking = isVoiceCanonicalAiBookingPublishMode(input.config);
  const v2PstnLiveBooking = isVoiceV2PstnLiveBookingMode(input.config);
  const v2Shared = v2PstnLiveBooking ? await resolveVoiceV2SharedToolIds() : null;

  const conversation_flow = buildAmyConversationWorkflow(
    {
      sendResource: shared.sendResourceId,
      searchDetails: shared.searchDetailsId,
      voiceAiBooking:
        canonicalBooking && !v2PstnLiveBooking ? shared.voiceAiBookingId : null,
      voiceV2Find: v2Shared?.findId ?? null,
      voiceV2Book: v2Shared?.bookId ?? null,
      voiceV2SaveIntake: v2Shared?.saveIntakeId ?? null,
      hangup: shared.hangupId,
      transfer: shared.transferId,
      retrieval: retrievalId,
    },
    input.config,
  );

  let tool_ids = [
    shared.sendResourceId,
    shared.searchDetailsId,
    ...(canonicalBooking && !v2PstnLiveBooking ? [shared.voiceAiBookingId] : []),
    shared.hangupId,
    shared.transferId,
  ].filter(Boolean) as string[];
  if (v2Shared) {
    tool_ids = mergeVoiceV2ToolIds(tool_ids, v2Shared);
  }

  try {
    await ai.updateAssistant(input.assistantId, {
      tool_ids,
      tools: [],
      conversation_flow,
    });
    const remote = await ai.getAssistant(input.assistantId);
    const data = ((remote as { data?: Record<string, unknown> }).data ||
      remote) as Record<string, unknown>;
    const flow = data.conversation_flow as { nodes?: unknown[] } | undefined;
    return {
      ok: true,
      toolIds: tool_ids,
      workflowNodes: Array.isArray(flow?.nodes) ? flow.nodes.length : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
