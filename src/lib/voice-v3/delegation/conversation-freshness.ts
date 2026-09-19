import type { VoiceToolResult } from "../tools/types";
import { toolOk } from "../tools/types";

export type VoiceToolFreshnessClass =
  | "SHARED_FACT"
  | "SEMANTIC_STEERING"
  | "READ"
  | "COMMITTED_WRITE"
  | "TERMINAL";

export type DelegationSemanticFreshness = "FRESH" | "STALE";

const TOOL_CLASS: Record<string, VoiceToolFreshnessClass> = {
  update_intake: "SHARED_FACT",
  set_scheduling_preference: "SEMANTIC_STEERING",
  find_availability: "READ",
  find_appointment: "READ",
  book_appointment: "COMMITTED_WRITE",
  reschedule_appointment: "COMMITTED_WRITE",
  cancel_appointment: "COMMITTED_WRITE",
  request_callback: "COMMITTED_WRITE",
  send_booking_link: "COMMITTED_WRITE",
  transfer_call: "TERMINAL",
  end_call: "TERMINAL",
};

export function classifyVoiceToolFreshness(toolName: string): VoiceToolFreshnessClass {
  return TOOL_CLASS[toolName] ?? "COMMITTED_WRITE";
}

/** Pre-dispatch: block new consequential work from a semantically stale delegation. */
export function shouldBlockStaleToolPreDispatch(
  toolName: string,
  semanticFreshness: DelegationSemanticFreshness,
): boolean {
  if (semanticFreshness !== "STALE") return false;
  const cls = classifyVoiceToolFreshness(toolName);
  switch (cls) {
    case "SHARED_FACT":
      return false;
    case "READ":
      return false;
    case "SEMANTIC_STEERING":
    case "COMMITTED_WRITE":
    case "TERMINAL":
      return true;
    default:
      return true;
  }
}

export function buildSemanticSupersededToolResult(input: {
  toolName: string;
  basedOnConversationRevision: number;
  currentConversationRevision: number;
  delegationId: string | null;
}): VoiceToolResult {
  return toolOk("SEMANTIC_SUPERSEDED", {
    status: "superseded",
    reason: "conversation_advanced",
    based_on_revision: input.basedOnConversationRevision,
    current_revision: input.currentConversationRevision,
    delegation_id: input.delegationId,
    tool: input.toolName,
  });
}

export function shouldApplySemanticSteeringToActiveGoal(
  toolName: string,
  semanticFreshness: DelegationSemanticFreshness,
): boolean {
  if (semanticFreshness === "FRESH") return true;
  const cls = classifyVoiceToolFreshness(toolName);
  return cls === "SHARED_FACT";
}
