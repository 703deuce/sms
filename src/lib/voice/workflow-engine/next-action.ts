import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import type { WorkflowState } from "./types";

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
      return "ASK_CALLER_FOR_PREFERRED_TIME: call continue_workflow({ user_input: \"<caller preferred time>\" }).";
    case "CHECKING_AVAILABILITY":
      return "ASK_CALLER_FOR_PREFERRED_TIME: call continue_workflow({ user_input: \"<caller preferred time>\" }).";
    case "SELECTING_SLOT":
      return "ASK_CALLER_TO_SELECT_SLOT: call continue_workflow({ user_input: \"<chosen slot>\" }).";
    case "READY_TO_BOOK":
      return "ASK_CALLER_TO_CONFIRM_BOOKING: call continue_workflow({ confirm: true }) only after explicit caller confirmation.";
    case "BOOKING_IN_PROGRESS":
      return "WAIT_FOR_BOOKING: wait for continue_workflow to finish.";
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
    return "DO NOT ADVANCE TO SCHEDULING until workflow_complete=true. Use record_current_field, not continue_workflow.";
  }
  return null;
}

/** No longer used for model-facing tools — scheduling is internal. */
export function stateAwareToolQualifier(_toolId: string): string {
  return "";
}
