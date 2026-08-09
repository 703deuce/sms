import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { LiveKitCallContext } from "@/lib/voice/domain-actions/session-bootstrap";
import type { DomainActionResult } from "@/lib/voice/domain-actions/booking-actions";

export type WorkflowTaskResult<T = Record<string, unknown>> = {
  complete: boolean;
  taskType: string;
  data: T;
  nextTask?: string | null;
  workflowState?: string;
};

export type WorkflowTaskContext = {
  callContext: LiveKitCallContext;
};

export interface WorkflowTask {
  readonly taskType: string;
  readonly description: string;
  resolveTaskType(session: AmyRealtimeSession): boolean;
  buildInstructions(session: AmyRealtimeSession): string;
  allowedTools(): string[];
}

export abstract class BaseWorkflowTask implements WorkflowTask {
  abstract readonly taskType: string;
  abstract readonly description: string;

  resolveTaskType(session: AmyRealtimeSession): boolean {
    return session.runtime.state === this.workflowStateForTask();
  }

  protected abstract workflowStateForTask(): AmyRealtimeSession["currentState"];

  buildInstructions(session: AmyRealtimeSession): string {
    return `${this.taskType}: ${this.description}`;
  }

  allowedTools(): string[] {
    return [];
  }
}

export function taskTypeForSession(session: AmyRealtimeSession): string {
  const ext = (session.runtime as { session_runtime?: { currentTask?: string } }).session_runtime;
  if (ext?.currentTask) return ext.currentTask;

  switch (session.currentState) {
    case "INTENT_DISCOVERY":
      return "DiscoverIntentTask";
    case "COLLECTING_FIELDS":
      return "CollectRequiredFieldsTask";
    case "CHECKING_AVAILABILITY":
      return "CheckAvailabilityTask";
    case "SELECTING_SLOT":
      return "SelectResourceTask";
    case "READY_TO_BOOK":
    case "BOOKING_IN_PROGRESS":
      return "ConfirmActionTask";
    case "COMPLETE":
      return "CompleteCallTask";
    default:
      return "DiscoverIntentTask";
  }
}

export const WORKFLOW_TASK_REGISTRY: WorkflowTask[] = [];

export function registerWorkflowTask(task: WorkflowTask) {
  WORKFLOW_TASK_REGISTRY.push(task);
}

export function resolveActiveTask(session: AmyRealtimeSession): WorkflowTask | null {
  const type = taskTypeForSession(session);
  return WORKFLOW_TASK_REGISTRY.find((t) => t.taskType === type) || null;
}

export function taskResultToDomainAction(
  result: WorkflowTaskResult,
  speak: string,
): DomainActionResult {
  return {
    ok: result.complete,
    speak,
    workflow_state: result.workflowState,
    data: result.data,
  };
}
