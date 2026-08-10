import type { CanonicalWorkflowState } from "@/lib/voice/workflow-runtime/canonical-state";
import { hasAvailableSlots, hasHeldSlot } from "@/lib/voice/workflow-runtime/completion-guards";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import { RUNTIME_EXECUTED_TOOL_NAMES } from "./deterministic-actions";

/** Semantic tools exposed to the LLM — map to internal domain actions at execution time. */
export const SEMANTIC_TOOL_NAMES = {
  capture_caller_information: "submit_caller_information",
  choose_appointment_time: "select_slot",
  confirm_action: "confirm_booking",
  answer_business_question: "get_business_answer",
  detect_caller_intent: "detect_caller_intent",
  modify_appointment: "modify_appointment",
  take_message: "take_message",
  transfer_to_human: "request_human",
  end_call: "end_call",
} as const;

export type SemanticToolName = keyof typeof SEMANTIC_TOOL_NAMES;

const INTERNAL_TO_SEMANTIC = Object.fromEntries(
  Object.entries(SEMANTIC_TOOL_NAMES).map(([semantic, internal]) => [internal, semantic]),
) as Record<string, SemanticToolName>;

export function internalToolName(semantic: SemanticToolName): string {
  return SEMANTIC_TOOL_NAMES[semantic];
}

export function semanticToolName(internal: string): string {
  return INTERNAL_TO_SEMANTIC[internal] || internal;
}

export function isRuntimeExecutedTool(toolName: string): boolean {
  return RUNTIME_EXECUTED_TOOL_NAMES.has(toolName);
}

/**
 * Compute semantic tools available for the current conversational boundary.
 * Deterministic internal operations are never included.
 */
export function compileSemanticToolNamesForSession(input: {
  canonical: CanonicalWorkflowState;
  envelopeToolNames: string[];
  session: AmyRealtimeSession;
  callerIntent?: string | null;
}): Set<SemanticToolName> {
  const foundAppointmentId =
    input.session.runtime?.session_runtime?.foundAppointmentId?.trim() || "";
  const allowed = new Set<SemanticToolName>();
  const internalAllowed = new Set(
    input.envelopeToolNames.filter((name) => !isRuntimeExecutedTool(name)),
  );

  const addIfInternal = (semantic: SemanticToolName, internal: string) => {
    if (internalAllowed.has(internal)) allowed.add(semantic);
  };

  addIfInternal("capture_caller_information", "submit_caller_information");
  addIfInternal("detect_caller_intent", "detect_caller_intent");
  addIfInternal("answer_business_question", "get_business_answer");
  addIfInternal("take_message", "take_message");
  addIfInternal("transfer_to_human", "request_human");
  addIfInternal("end_call", "end_call");

  if (
    internalAllowed.has("select_slot") &&
    hasAvailableSlots(input.session) &&
    !hasHeldSlot(input.session)
  ) {
    allowed.add("choose_appointment_time");
  }

  if (internalAllowed.has("confirm_booking") && hasHeldSlot(input.session)) {
    allowed.add("confirm_action");
  }

  if (
    internalAllowed.has("cancel_appointment") &&
    input.callerIntent === "cancel" &&
    foundAppointmentId
  ) {
    allowed.add("confirm_action");
  }

  const modifyFlow =
    input.callerIntent === "reschedule" ||
    input.callerIntent === "cancel" ||
    internalAllowed.has("find_appointments") ||
    internalAllowed.has("reschedule_appointment") ||
    internalAllowed.has("cancel_appointment");

  if (modifyFlow) {
    allowed.add("modify_appointment");
    if (
      input.callerIntent === "reschedule" &&
      hasAvailableSlots(input.session) &&
      !hasHeldSlot(input.session)
    ) {
      allowed.add("choose_appointment_time");
    }
    if (
      internalAllowed.has("reschedule_appointment") &&
      input.callerIntent === "reschedule" &&
      foundAppointmentId &&
      hasHeldSlot(input.session)
    ) {
      allowed.add("confirm_action");
    }
  }

  return allowed;
}
