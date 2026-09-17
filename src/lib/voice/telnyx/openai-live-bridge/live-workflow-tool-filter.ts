import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
  VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
} from "@/lib/voice-v2/telnyx-tool-definition";
import type { VoiceV2NextStage } from "@/lib/voice-v2/booking-workflow";
import {
  buildLiveVoiceTools,
  type LiveResponsesFunctionTool,
} from "./live-tools";
import type { VoiceV2CallCapabilitySnapshot } from "@/lib/voice-v2/workflow-capability";

/** Maps workflow `allowed_next_actions` entries to Live/Responses function tool names. */
const WORKFLOW_ACTION_TO_TOOL_NAME: Record<string, string> = {
  voice_v2_save_intake_fields: VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  voice_v2_find_availability: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  voice_v2_book_offered_slot: VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  voice_v2_finalize_caller_request: VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
  voice_v2_send_booking_link: VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
  callback_path: VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  transfer: VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
};

export function workflowActionsToToolNames(allowedActions: string[]): Set<string> {
  const names = new Set<string>();
  for (const action of allowedActions) {
    const tool = WORKFLOW_ACTION_TO_TOOL_NAME[action];
    if (tool) names.add(tool);
  }
  return names;
}

export function filterLiveToolsForWorkflow(input: {
  config: VoiceAgentConfig;
  capability: VoiceV2CallCapabilitySnapshot;
  allowedActions: string[];
  transferEnabled?: boolean;
}): LiveResponsesFunctionTool[] {
  const allowedToolNames = workflowActionsToToolNames(input.allowedActions);
  if (allowedToolNames.size === 0) return [];
  const pool = buildLiveVoiceTools({
    config: input.config,
    transferEnabled: input.transferEnabled,
  });
  return pool.filter((t) => allowedToolNames.has(t.name));
}

export function isToolNameAllowedByWorkflow(
  toolName: string,
  allowedActions: string[],
): boolean {
  const allowed = workflowActionsToToolNames(allowedActions);
  return allowed.has(toolName);
}

/** Backend should proactively continue only when scheduling tools may need to run. */
export function shouldIssueResponseCreateOnDelegation(
  stage: VoiceV2NextStage,
  allowedActions: string[],
): boolean {
  if (stage === "BOOKING_CONFIRMED" || stage === "COMPLETE") return false;
  if (allowedActions.length === 0) return false;
  const proactiveStages: VoiceV2NextStage[] = [
    "FIND_AVAILABILITY",
    "OFFER_SLOTS",
    "BOOK_SELECTED_SLOT",
  ];
  return proactiveStages.includes(stage);
}
