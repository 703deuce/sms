/**
 * Push Telnyx Conversation Workflow + shared tool_ids for Amy production.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import * as ai from "./ai-client";
import { buildAmyConversationWorkflow } from "./conversation-workflow";
import { ensureTransovoSharedWorkflowTools } from "./shared-tools";
import { isVoiceCanonicalAiBookingPublishMode } from "@/lib/voice/workflow-engine/tool-publish";
import {
  isVoiceV2PstnLiveBookingMode,
  isVoiceV2PstnOneAmyMode,
  resolveVoiceV2BookingStrategy,
} from "@/lib/voice-v2/pstn-workflow-mode";
import {
  expectedVoiceV2LiveBooking,
  verifyVoiceV2WorkflowReadBack,
  VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
} from "@/lib/voice-v2/workflow-capability";
import { mergeVoiceV2ToolIds } from "./voice-v2-shared-tools";
import { ensureVoiceV2SharedToolsForAgent } from "./ensure-voice-v2-shared-tools";
import { readTelnyxWorkflowState } from "./workflow-readback";
import type { VoiceV2SharedToolIds } from "./voice-v2-shared-tools";

export type TransovoWorkflowSharedIds = {
  sendResourceId: string;
  searchDetailsId: string;
  voiceAiBookingId: string;
  hangupId: string;
  transferId: string;
};

/** Pure desired state from config — used by sync and headless certification (no Telnyx I/O). */
export function buildDesiredTelnyxWorkflowPayload(input: {
  shared: TransovoWorkflowSharedIds;
  v2Shared: VoiceV2SharedToolIds | null;
  config: VoiceAgentConfig;
}): {
  conversation_flow: Record<string, unknown>;
  tool_ids: string[];
  v2PstnLiveBooking: boolean;
} {
  const canonicalBooking = isVoiceCanonicalAiBookingPublishMode(input.config);
  const v2PstnLiveBooking = expectedVoiceV2LiveBooking(input.config);
  const v2OneAmy = isVoiceV2PstnOneAmyMode(input.config);

  const conversation_flow = buildAmyConversationWorkflow(
    {
      sendResource: input.shared.sendResourceId,
      searchDetails: input.shared.searchDetailsId,
      voiceAiBooking:
        canonicalBooking && !v2PstnLiveBooking ? input.shared.voiceAiBookingId : null,
      voiceV2Find: input.v2Shared?.findId ?? null,
      voiceV2Book: input.v2Shared?.bookId ?? null,
      voiceV2SaveIntake: input.v2Shared?.saveIntakeId ?? null,
      voiceV2FinalizeRequest: input.v2Shared?.finalizeRequestId ?? null,
      voiceV2SendBookingLink: input.v2Shared?.sendBookingLinkId ?? null,
      voiceV2FindExisting: input.v2Shared?.findExistingId ?? null,
      voiceV2Reschedule: input.v2Shared?.rescheduleId ?? null,
      voiceV2Cancel: input.v2Shared?.cancelId ?? null,
      hangup: input.shared.hangupId,
      transfer: input.shared.transferId,
      retrieval: null,
    },
    input.config,
  );

  let tool_ids = [
    input.shared.sendResourceId,
    input.shared.searchDetailsId,
    ...(canonicalBooking && !v2PstnLiveBooking ? [input.shared.voiceAiBookingId] : []),
    input.shared.hangupId,
    input.shared.transferId,
  ].filter(Boolean) as string[];
  if (input.v2Shared && v2OneAmy) {
    tool_ids = mergeVoiceV2ToolIds(tool_ids, input.v2Shared);
  }

  return { conversation_flow, tool_ids, v2PstnLiveBooking };
}

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
  capabilityMismatch?: string;
}> {
  const shared = await ensureTransovoSharedWorkflowTools({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    transferTargets: input.transferTargets,
  });

  const v2PstnLiveBooking = expectedVoiceV2LiveBooking(input.config);
  const bookingStrategy = resolveVoiceV2BookingStrategy(input.config);
  const v2OneAmy = isVoiceV2PstnOneAmyMode(input.config);

  let v2Shared = null as Awaited<ReturnType<typeof ensureVoiceV2SharedToolsForAgent>> | null;
  if (v2OneAmy) {
    v2Shared = await ensureVoiceV2SharedToolsForAgent({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      bookingStrategy,
    });
    const sendLinkMode = bookingStrategy === "SEND_LINK";
    if (!v2Shared.saveIntakeId) {
      return {
        ok: false,
        error: "voice_v2_shared_tools_unavailable",
        capabilityMismatch: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
      };
    }
    if (sendLinkMode && !v2Shared.sendBookingLinkId) {
      return {
        ok: false,
        error: "voice_v2_send_link_tool_unavailable",
        capabilityMismatch: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
      };
    }
    if (!sendLinkMode && !v2Shared.finalizeRequestId) {
      return {
        ok: false,
        error: "voice_v2_shared_tools_unavailable",
        capabilityMismatch: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
      };
    }
    if (v2PstnLiveBooking && (!v2Shared.findId || !v2Shared.bookId)) {
      return {
        ok: false,
        error: "voice_v2_live_booking_tools_unavailable",
        capabilityMismatch: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
      };
    }
  }

  const { conversation_flow, tool_ids } = buildDesiredTelnyxWorkflowPayload({
    shared,
    v2Shared,
    config: input.config,
  });

  try {
    await ai.updateAssistant(input.assistantId, {
      tool_ids,
      tools: [],
      conversation_flow,
    });

    const readBack = await readTelnyxWorkflowState(input.assistantId);
    const verified = verifyVoiceV2WorkflowReadBack({
      expectedVoiceV2Booking: v2PstnLiveBooking,
      expectedOneAmyIntake: v2OneAmy && !v2PstnLiveBooking && bookingStrategy !== "SEND_LINK",
      expectedOneAmySendLink: bookingStrategy === "SEND_LINK",
      readBack,
    });
    if (!verified.ok) {
      console.error(
        "[workflow-sync]",
        VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
        verified.detail,
      );
      return {
        ok: false,
        error: verified.detail,
        capabilityMismatch: verified.code,
        toolIds: tool_ids,
      };
    }

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
