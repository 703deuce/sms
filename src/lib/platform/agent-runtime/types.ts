/**
 * Shared Transovo agent-runtime primitives — used by Caller Amy, Owner Amy,
 * Workflow Architect, and future agents.
 *
 * Invariant: LLMs propose decisions; the runtime authorizes and executes them.
 */

export type AgentRole =
  | "caller_amy"
  | "owner_amy"
  | "workflow_architect"
  | "missed_call_text_back"
  | "custom";

export type OperationStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "already_completed"
  | "blocked"
  | "candidate_created"
  | "tests_passed"
  | "published"
  | "rollback_completed";

export type PlatformOperationReceipt = {
  operation_id: string;
  type: string;
  status: OperationStatus;
  agent_role: AgentRole;
  tenant_id: string;
  user_id?: string | null;
  agent_id?: string | null;
  workflow_id?: string | null;
  change_request_id?: string | null;
  old_version?: number | null;
  new_version?: number | null;
  provider?: string | null;
  provider_reference?: string | null;
  error_code?: string | null;
  created_at: string;
  completed_at?: string | null;
  metadata?: Record<string, unknown>;
};

export type PlatformToolErrorCode =
  | "TOOL_NOT_ALLOWED"
  | "PERMISSION_DENIED"
  | "CONFIRMATION_REQUIRED"
  | "INVALID_INPUT"
  | "VALIDATION_FAILED"
  | "CAPABILITY_NOT_SUPPORTED"
  | "TESTS_NOT_PASSED"
  | "WRITE_IN_PROGRESS"
  | "TENANT_MISMATCH"
  | "INTERNAL_ERROR";

export type PlatformToolResult<T = Record<string, unknown>> = {
  success: boolean;
  operation_id: string;
  status: OperationStatus;
  error_code?: PlatformToolErrorCode;
  user_message?: string;
  retryable?: boolean;
  data: T;
  receipt?: PlatformOperationReceipt;
};

export type PlatformPermission =
  | "agent.read"
  | "agent.settings.write"
  | "workflow.read"
  | "workflow.change.request"
  | "workflow.publish"
  | "workflow.rollback"
  | "integration.read"
  | "integration.write"
  | "logs.read"
  | "tests.run";

export type PlatformSessionBase = {
  session_id: string;
  tenant_id: string;
  user_id: string;
  permissions: PlatformPermission[];
  active_agent_id?: string | null;
  active_workflow_id?: string | null;
  active_change_request_id?: string | null;
  pending_confirmation?: string | null;
  operation_receipts: PlatformOperationReceipt[];
  execution_trace: Array<{ at: string; event: string; detail?: string }>;
  updated_at: string;
};
