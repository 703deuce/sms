import type { DomainActionResult } from "@/lib/voice/domain-actions/booking-actions";
import type { StructuredToolResult } from "@/lib/voice/session-runtime/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";

export const TOOL_ERROR_CODES = [
  "PRECONDITION_FAILED",
  "MISSING_FIELDS",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "AMBIGUOUS_MATCH",
  "NO_AVAILABILITY",
  "HOLD_EXPIRED",
  "CONFLICT",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "TRANSFER_NO_ANSWER",
  "TRANSFER_FAILED",
  "DUPLICATE_OPERATION",
  "NO_ACTIVE_FIELD",
  "NO_FIELDS",
  "SLOT_NOT_RECOGNIZED",
  "OUT_OF_SERVICE_AREA",
] as const;

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

export function toStructuredResult(
  result: DomainActionResult,
  options?: {
    nextAllowedActions?: string[];
    retryable?: boolean;
  },
): StructuredToolResult {
  return {
    ok: result.ok,
    code: result.error_code,
    retryable: options?.retryable ?? isRetryableError(result.error_code),
    userSafeMessage: result.speak,
    nextAllowedActions: options?.nextAllowedActions,
    workflowState: result.workflow_state as WorkflowState | undefined,
    data: result.data,
  };
}

export function isRetryableError(code?: string | null): boolean {
  if (!code) return false;
  return ["RATE_LIMITED", "PROVIDER_UNAVAILABLE", "HOLD_EXPIRED"].includes(code);
}

export function structuredFailure(input: {
  speak: string;
  code: ToolErrorCode;
  workflowState?: WorkflowState;
  retryable?: boolean;
  nextAllowedActions?: string[];
  data?: Record<string, unknown>;
}): DomainActionResult {
  return {
    ok: false,
    speak: input.speak,
    error_code: input.code,
    workflow_state: input.workflowState,
    data: {
      ...(input.data || {}),
      retryable: input.retryable ?? isRetryableError(input.code),
      nextAllowedActions: input.nextAllowedActions,
    },
  };
}

export function structuredSuccess(input: {
  speak: string;
  workflowState?: WorkflowState;
  data?: Record<string, unknown>;
  nextAllowedActions?: string[];
}): DomainActionResult {
  return {
    ok: true,
    speak: input.speak,
    workflow_state: input.workflowState,
    data: {
      ...(input.data || {}),
      nextAllowedActions: input.nextAllowedActions,
    },
  };
}
