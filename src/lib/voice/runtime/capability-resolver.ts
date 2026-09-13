/**
 * Resolves permitted voice tools/capabilities from policy + call state.
 * Telnyx model must only see eligible tools for the current workflow state.
 */
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { LeadRecoveryActionId, PolicyEvaluationResult } from "@/lib/mctb/lead-recovery/types";
import {
  isConversationWorkflowMode,
  WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
} from "@/lib/voice/workflow-engine/tool-publish";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { VoiceAfterHoursCallState, VoiceWorkflowState } from "./types";
import { isAfterHoursVoiceProfile } from "./voice-profile";

/** Model-facing Telnyx webhook tools in minimum-side-effect / conversation-workflow mode. */
export const VOICE_PUBLISHED_TOOL_NAMES = [
  "hangup",
  "transfer",
  "send_resource",
  "search_business_details",
] as const;

export type VoicePublishedTool = (typeof VOICE_PUBLISHED_TOOL_NAMES)[number];

const STATE_DEFAULT_TOOLS: Partial<Record<VoiceWorkflowState, VoicePublishedTool[]>> = {
  GREETING: [],
  INTENT_IDENTIFICATION: [],
  GENERAL_MESSAGE: ["hangup"],
  SERVICE_INQUIRY: ["hangup", "search_business_details"],
  EMERGENCY_INTAKE: ["transfer", "hangup"],
  CALLBACK_REQUEST: ["hangup"],
  BOOKING_REQUEST: ["send_resource", "hangup"],
  FAQ: ["search_business_details", "hangup"],
  MESSAGE_CONFIRMATION: ["hangup"],
  NOTIFICATION: ["hangup"],
  SAFE_FALLBACK: ["hangup", "transfer"],
  COMPLETE: ["hangup"],
};

const ACTION_TO_CAPABILITY: Partial<Record<LeadRecoveryActionId, string>> = {
  SEND_BOOKING_LINK: "send_booking_link",
  AI_BOOK: "ai_booking",
  CREATE_CALLBACK_REQUEST: "capture_callback",
  ESCALATE_HUMAN: "transfer_to_human",
  ROUTE_TO_ON_CALL: "notify_on_call",
  SEND_OWNER_SMS: "notify_business",
  SEND_EMAIL_SUMMARY: "notify_business",
  ANSWER_APPROVED_INFORMATION: "answer_from_prompt",
  CUSTOMER_MESSAGE: "capture_message",
};

const ACTION_TO_TOOL: Partial<Record<LeadRecoveryActionId, VoicePublishedTool>> = {
  SEND_BOOKING_LINK: "send_resource",
  ESCALATE_HUMAN: "transfer",
  ROUTE_TO_ON_CALL: "transfer",
};

function baseToolsForState(state: VoiceWorkflowState): VoicePublishedTool[] {
  return [...(STATE_DEFAULT_TOOLS[state] || ["hangup"])];
}

function policyPermitsAction(
  policy: PolicyEvaluationResult | null,
  action: LeadRecoveryActionId,
): boolean {
  if (!policy) return false;
  return policy.permittedActions.includes(action) || policy.nextActions.some((a) => a.action === action);
}

export function resolveVoiceCapabilities(input: {
  callState: VoiceAfterHoursCallState;
  wizard: AppointmentReceptionistWizardState;
  policy?: PolicyEvaluationResult | null;
}): { capabilities: string[]; allowedTools: VoicePublishedTool[] } {
  const capabilities = new Set<string>(["capture_message", "end_call"]);
  const tools = new Set<VoicePublishedTool>(baseToolsForState(input.callState.currentState));

  if (input.wizard.capabilities.includes("answer_questions")) {
    capabilities.add("answer_from_prompt");
  }

  if (input.policy) {
    for (const action of input.policy.permittedActions) {
      if (isAfterHoursVoiceProfile(input.wizard) && action === "AI_BOOK") continue;
      const cap = ACTION_TO_CAPABILITY[action];
      if (cap) capabilities.add(cap);
      const tool = ACTION_TO_TOOL[action];
      if (tool) tools.add(tool);
    }
    for (const next of input.policy.nextActions) {
      if (isAfterHoursVoiceProfile(input.wizard) && next.action === "AI_BOOK") continue;
      const cap = ACTION_TO_CAPABILITY[next.action];
      if (cap) capabilities.add(cap);
      const tool = ACTION_TO_TOOL[next.action];
      if (tool) tools.add(tool);
    }
  }

  if (
    input.callState.currentState === "BOOKING_REQUEST" &&
    input.wizard.capabilities.includes("book_appointments") &&
    policyPermitsAction(input.policy ?? null, "SEND_BOOKING_LINK")
  ) {
    tools.add("send_resource");
    capabilities.add("send_booking_link");
  }

  if (
    input.wizard.capabilities.includes("transfer_calls") &&
    wizardTransferEnabled(input.wizard) &&
    (input.callState.currentState === "EMERGENCY_INTAKE" ||
      input.callState.currentState === "SAFE_FALLBACK" ||
      policyPermitsAction(input.policy ?? null, "ESCALATE_HUMAN"))
  ) {
    tools.add("transfer");
    capabilities.add("transfer_to_human");
  }

  if (
    input.wizard.capabilities.includes("answer_questions") &&
    input.callState.currentState === "FAQ"
  ) {
    tools.add("search_business_details");
  }

  return {
    capabilities: [...capabilities],
    allowedTools: [...tools],
  };
}

function wizardTransferEnabled(wizard: AppointmentReceptionistWizardState): boolean {
  return Boolean(wizard.transferDestinationPhone?.trim());
}

const WORKFLOW_GRAPH_TOOLS = new Set<string>(WORKFLOW_PUBLISHED_WEBHOOK_TOOLS);

export function filterPublishedToolsForRuntime(input: {
  requestedTool: string;
  callState: VoiceAfterHoursCallState | null;
  agentConfig?: VoiceAgentConfig | null;
}): { allowed: boolean; reason?: string } {
  if (!isConversationWorkflowMode(input.agentConfig)) {
    return { allowed: true };
  }
  // Telnyx conversation-workflow nodes decide when send_resource / search run.
  // Server runtime state (often GREETING on first tool) must not double-block SMS.
  if (WORKFLOW_GRAPH_TOOLS.has(input.requestedTool)) {
    return { allowed: true };
  }
  if (!input.callState?.allowedTools?.length) {
    const defaults = baseToolsForState(input.callState?.currentState || "GREETING");
    if (defaults.includes(input.requestedTool as VoicePublishedTool)) {
      return { allowed: true };
    }
    if (input.requestedTool === "hangup") return { allowed: true };
    return {
      allowed: false,
      reason: `No tools enabled for state ${input.callState?.currentState || "GREETING"}.`,
    };
  }
  if (input.callState.allowedTools.includes(input.requestedTool)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Tool "${input.requestedTool}" is not permitted in state ${input.callState.currentState}.`,
  };
}

export function mapWorkflowStateFromIntent(intent: string | null): VoiceWorkflowState {
  switch (intent) {
    case "EMERGENCY_OR_URGENT":
      return "EMERGENCY_INTAKE";
    case "BOOKING_REQUEST":
    case "SPECIFIC_TIME_REQUEST":
      return "BOOKING_REQUEST";
    case "CALLBACK_REQUEST":
      return "CALLBACK_REQUEST";
    case "BUSINESS_HOURS":
    case "BUSINESS_FAQ":
    case "BUSINESS_LOCATION":
    case "PRICING_QUESTION":
    case "SERVICE_AREA_CHECK":
    case "GENERAL_INQUIRY":
      return "FAQ";
    case "SERVICE_REQUEST":
    case "EXISTING_CUSTOMER_ISSUE":
      return "SERVICE_INQUIRY";
    case "TRANSFER_REQUEST":
      return "SAFE_FALLBACK";
    default:
      return "INTENT_IDENTIFICATION";
  }
}
