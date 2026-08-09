import type { WorkflowState } from "@/lib/voice/workflow-engine/types";

/** Task-scoped tool allowlist — defense in depth beyond LiveKit tool visibility. */
const TASK_TOOLS: Record<string, readonly string[]> = {
  DiscoverIntentTask: [
    "get_booking_requirements",
    "record_current_field",
    "take_message",
    "request_human",
    "end_call",
  ],
  CollectBookingFieldsTask: [
    "record_current_field",
    "get_booking_requirements",
    "request_human",
    "end_call",
  ],
  CheckAvailabilityTask: ["check_availability", "request_human", "end_call"],
  SelectSlotTask: ["select_slot", "check_availability", "request_human", "end_call"],
  ConfirmBookingTask: ["confirm_booking", "request_human", "end_call"],
  CompleteCallTask: ["end_call", "request_human"],
};

const STATE_TO_TASK: Record<WorkflowState, string> = {
  INTENT_DISCOVERY: "DiscoverIntentTask",
  COLLECTING_FIELDS: "CollectBookingFieldsTask",
  CHECKING_AVAILABILITY: "CheckAvailabilityTask",
  SELECTING_SLOT: "SelectSlotTask",
  READY_TO_BOOK: "ConfirmBookingTask",
  BOOKING_IN_PROGRESS: "ConfirmBookingTask",
  COMPLETE: "CompleteCallTask",
  GENERAL: "CompleteCallTask",
};

export function taskForWorkflowState(state: WorkflowState): string {
  return STATE_TO_TASK[state] || "DiscoverIntentTask";
}

export function workflowStateForTask(taskId: string): WorkflowState | null {
  const entry = Object.entries(STATE_TO_TASK).find(([, task]) => task === taskId);
  return (entry?.[0] as WorkflowState | undefined) || null;
}

export function assertTaskToolAllowed(taskId: string, toolName: string): void {
  const allowed = TASK_TOOLS[taskId];
  if (!allowed?.includes(toolName)) {
    throw new Error(`Tool ${toolName} is not available in task ${taskId}`);
  }
}

export function toolsForTask(taskId: string): readonly string[] {
  return TASK_TOOLS[taskId] || [];
}

/** Next task in the booking workflow — used to pre-register tools for same-turn chains. */
const TASK_TRANSITION_CHAIN: Record<string, string | null> = {
  DiscoverIntentTask: "CollectBookingFieldsTask",
  CollectBookingFieldsTask: "CheckAvailabilityTask",
  CheckAvailabilityTask: "SelectSlotTask",
  SelectSlotTask: "ConfirmBookingTask",
  ConfirmBookingTask: "CompleteCallTask",
  CompleteCallTask: null,
};

/**
 * Tools exposed to the LiveKit agent for the active task plus the next task.
 *
 * LiveKit reuses the tool context captured at the start of a speech turn when
 * chaining tool calls (e.g. record_current_field → check_availability). Pre-registering
 * the next-phase tool avoids "unknown AI function" when the model calls it in the same turn.
 * Domain actions still enforce task allowlists via assertTaskToolAllowed.
 */
export function toolsForTaskWithChain(taskId: string): readonly string[] {
  const current = toolsForTask(taskId);
  const nextTaskId = TASK_TRANSITION_CHAIN[taskId];
  if (!nextTaskId) return current;
  const next = toolsForTask(nextTaskId);
  return [...new Set([...current, ...next])];
}
