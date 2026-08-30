import type { VoiceAgentConfig } from "@/lib/voice/types";
import { STATE_ALLOWED_TOOLS } from "./states";

/** Union of all tools the runtime may invoke internally during a booking call. */
export const CALLER_AMY_WORKFLOW_TOOL_UNION: readonly string[] = [
  ...new Set(
    Object.values(STATE_ALLOWED_TOOLS).flatMap((tools) => [...tools]),
  ),
];

/** Telnyx Conversation Workflow — model-facing custom webhooks (per-node scoped). */
export const WORKFLOW_PUBLISHED_WEBHOOK_TOOLS = [
  "send_resource",
  "search_business_details",
] as const;

/** Minimum side-effect flat surface (pre-workflow). */
export const CALLER_AMY_MINIMUM_WEBHOOK_TOOLS = [
  "send_sms",
  "record_call_fact",
  "take_structured_message",
  "lookup_customer",
  "escalate_human",
] as const;

/** @deprecated alias */
export const CALLER_AMY_PUBLISHED_WEBHOOK_TOOLS = CALLER_AMY_MINIMUM_WEBHOOK_TOOLS;

/** Legacy workflow surface — used only when minimumSideEffectMode is false. */
export const CALLER_AMY_WORKFLOW_WEBHOOK_TOOLS = [
  "lookup_customer",
  "take_structured_message",
  "record_current_field",
  "continue_workflow",
  "get_runtime_context",
  "escalate_human",
] as const;

export function isConversationWorkflowMode(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.conversationWorkflowMode === true;
}

export function resolveCallerAmyPublishedWebhookTools(
  config?: { advanced?: Record<string, unknown> } | null,
): readonly string[] {
  const advanced = config?.advanced || {};
  if (advanced.conversationWorkflowMode === true) {
    return WORKFLOW_PUBLISHED_WEBHOOK_TOOLS;
  }
  if (advanced.minimumSideEffectMode === true) {
    return CALLER_AMY_MINIMUM_WEBHOOK_TOOLS;
  }
  return CALLER_AMY_WORKFLOW_WEBHOOK_TOOLS;
}

/** Scheduling + gateway tools kept internal — invoked by continue_workflow / runtime only. */
export const CALLER_AMY_INTERNAL_ONLY_TOOLS = new Set([
  "runtime_turn",
  "resolve_datetime",
  "calendar_availability",
  "check_availability",
  "book_appointment",
  "hold_appointment_slot",
  "release_appointment_hold",
  "find_appointments",
  "reschedule_appointment",
  "cancel_appointment",
  "continue_workflow",
  "get_runtime_context",
  "record_current_field",
  "save_collected_fields",
  "get_workflow_requirements",
  "save_caller_info",
  "save_customer_info",
  "check_customer_fields",
  "check_field_requirements",
  "mark_disposition",
  "create_crm_note",
  "create_crm_task",
  "upsert_crm_contact",
  "update_contact_tags",
  "search_crm_contacts",
  "send_dtmf",
  "create_task",
  "end_call",
  "confirm_booking",
]);

/** Retired from model surface when conversationWorkflowMode is on. */
export const WORKFLOW_RETIRED_FLAT_TOOLS = new Set([
  "send_sms",
  "record_call_fact",
  "take_structured_message",
  "lookup_customer",
  "escalate_human",
]);

/** @deprecated Use WORKFLOW_PUBLISHED_WEBHOOK_TOOLS or CALLER_AMY_MINIMUM_WEBHOOK_TOOLS */
export const CALLER_AMY_MODEL_TOOLS = WORKFLOW_PUBLISHED_WEBHOOK_TOOLS;

/** @deprecated Use CALLER_AMY_INTERNAL_ONLY_TOOLS */
export const CALLER_AMY_PUBLISH_EXCLUDED = CALLER_AMY_INTERNAL_ONLY_TOOLS;

/** @deprecated */
export const CALLER_AMY_PUBLISH_REQUIRED = [...CALLER_AMY_PUBLISHED_WEBHOOK_TOOLS] as const;

/** Domain-level aliases — not published to model */
export const DOMAIN_TOOL_ALIASES: Record<string, string> = {
  confirm_booking: "book_appointment",
  check_availability: "calendar_availability",
  get_booking_requirements: "get_workflow_requirements",
};

/**
 * Filter enabled catalog keys for Telnyx publish — direct webhook surface only.
 * Scheduling primitives and the retired runtime_turn gateway stay internal.
 */
export function filterToolsForCallerAmyPublish(
  enabledKeys: string[],
  config?: { advanced?: Record<string, unknown> } | null,
): string[] {
  const allowed = new Set(resolveCallerAmyPublishedWebhookTools(config));
  const published = new Set<string>();
  for (const key of enabledKeys) {
    if (CALLER_AMY_INTERNAL_ONLY_TOOLS.has(key)) continue;
    if (isConversationWorkflowMode(config) && WORKFLOW_RETIRED_FLAT_TOOLS.has(key)) {
      continue;
    }
    if (allowed.has(key)) published.add(key);
  }
  published.delete("runtime_turn");
  for (const required of allowed) {
    if (enabledKeys.includes(required)) published.add(required);
  }
  return [...published];
}

export function isCallerAmyAgent(agentType?: string | null): boolean {
  return agentType === "receptionist" || agentType === "appointment_booking" || !agentType;
}

export function isInternalOnlyTool(
  toolType: string,
  config?: { advanced?: Record<string, unknown> } | null,
): boolean {
  if (isConversationWorkflowMode(config) && WORKFLOW_RETIRED_FLAT_TOOLS.has(toolType)) {
    return true;
  }
  return CALLER_AMY_INTERNAL_ONLY_TOOLS.has(toolType);
}
