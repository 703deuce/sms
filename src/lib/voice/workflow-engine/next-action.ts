import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import type { WorkflowState } from "./types";

const STATE_AWARE_PREFIX =
  "The Transovo runtime determines workflow sequence. Do not advance stages yourself. ";

export function deriveNextAction(input: {
  state: WorkflowState;
  complete: boolean;
  currentField?: RuntimeFieldManifestEntry | null;
  missingFields?: RuntimeFieldManifestEntry[];
}): string | null {
  const missing = input.missingFields || [];
  const field = input.currentField || missing[0] || null;

  switch (input.state) {
    case "INTENT_DISCOVERY":
    case "COLLECTING_FIELDS":
      if (!input.complete && field) {
        return `COLLECT_CURRENT_FIELD: ask for "${field.label}", then call record_current_field({ value: "<caller answer>" }).`;
      }
      if (!input.complete) {
        return "COLLECT_CURRENT_FIELD: call get_runtime_context, then record_current_field for each missing required field.";
      }
      return "CHECK_AVAILABILITY: required fields are complete — call get_runtime_context before scheduling tools.";
    case "CHECKING_AVAILABILITY":
      return "CHECK_AVAILABILITY: resolve_datetime if needed, then calendar_availability when runtime permits.";
    case "SELECTING_SLOT":
      return "SELECT_SLOT: offer slots from calendar_availability; hold_appointment_slot when caller picks a time.";
    case "READY_TO_BOOK":
      return "CONFIRM_BOOKING: call book_appointment with startsAt from the selected slot.";
    case "BOOKING_IN_PROGRESS":
      return "WAIT_FOR_BOOKING: wait for book_appointment to finish.";
    case "COMPLETE":
      return null;
    case "GENERAL":
      return null;
    default:
      return null;
  }
}

export function schedulingDoNotAdvanceHint(state: WorkflowState): string | null {
  if (state === "INTENT_DISCOVERY" || state === "COLLECTING_FIELDS") {
    return "DO NOT ADVANCE TO SCHEDULING until workflow_complete=true.";
  }
  return null;
}

/** Shared qualifier appended to state-gated tool descriptions. */
export function stateAwareToolQualifier(toolId: string): string {
  const gates: Record<string, string> = {
    resolve_datetime:
      "USE ONLY when workflow_state is CHECKING_AVAILABILITY or SELECTING_SLOT and this tool is in allowed_tools.",
    calendar_availability:
      "USE ONLY when workflow_state is CHECKING_AVAILABILITY or SELECTING_SLOT and this tool is in allowed_tools. DO NOT USE while required fields remain incomplete.",
    hold_appointment_slot:
      "USE ONLY when workflow_state is SELECTING_SLOT or READY_TO_BOOK and this tool is in allowed_tools.",
    release_appointment_hold:
      "USE ONLY when workflow_state is SELECTING_SLOT or READY_TO_BOOK and this tool is in allowed_tools.",
    book_appointment:
      "USE ONLY when workflow_state is READY_TO_BOOK and this tool is in allowed_tools. DO NOT infer readiness from conversation alone.",
    find_appointments:
      "USE ONLY when workflow_state is COMPLETE or GENERAL and this tool is in allowed_tools.",
    reschedule_appointment:
      "USE ONLY when workflow_state is COMPLETE and this tool is in allowed_tools.",
    cancel_appointment:
      "USE ONLY when workflow_state is COMPLETE and this tool is in allowed_tools.",
  };
  const gate = gates[toolId];
  if (!gate) return "";
  return `${STATE_AWARE_PREFIX}${gate}`;
}
