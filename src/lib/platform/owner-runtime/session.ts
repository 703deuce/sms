/**
 * Owner Amy external session state — survives LLM context loss.
 */
import type { PlatformOperationReceipt, PlatformPermission, PlatformSessionBase } from "../agent-runtime/types";

export type OwnerTask =
  | "GENERAL"
  | "DIAGNOSE"
  | "CHANGE_REQUEST"
  | "WORKFLOW_BUILD"
  | "PUBLISH"
  | "ROLLBACK"
  | "TEST";

export type OwnerAmySessionRecord = PlatformSessionBase & {
  current_task: OwnerTask;
  known_context: Record<string, string>;
  pending_confirmation?: string | null;
  completed_operations: string[];
  recent_tool_results: Array<{ tool: string; status: string; at: string }>;
  candidate_version?: number | null;
  tests_passed?: boolean;
};

export function createOwnerAmySession(input: {
  session_id: string;
  tenant_id: string;
  user_id: string;
  permissions?: PlatformPermission[];
}): OwnerAmySessionRecord {
  const now = new Date().toISOString();
  return {
    session_id: input.session_id,
    tenant_id: input.tenant_id,
    user_id: input.user_id,
    permissions: input.permissions || defaultOwnerPermissions(),
    current_task: "GENERAL",
    known_context: {},
    completed_operations: [],
    recent_tool_results: [],
    operation_receipts: [],
    execution_trace: [],
    updated_at: now,
  };
}

export function defaultOwnerPermissions(): PlatformPermission[] {
  return [
    "agent.read",
    "agent.settings.write",
    "workflow.read",
    "workflow.change.request",
    "workflow.publish",
    "workflow.rollback",
    "integration.read",
    "logs.read",
    "tests.run",
  ];
}

export function appendOwnerTrace(
  session: OwnerAmySessionRecord,
  event: string,
  detail?: string,
): OwnerAmySessionRecord {
  return {
    ...session,
    execution_trace: [
      ...session.execution_trace,
      { at: new Date().toISOString(), event, detail },
    ],
    updated_at: new Date().toISOString(),
  };
}

export function appendOwnerReceipt(
  session: OwnerAmySessionRecord,
  receipt: PlatformOperationReceipt,
): OwnerAmySessionRecord {
  return {
    ...session,
    operation_receipts: [...session.operation_receipts, receipt],
    updated_at: new Date().toISOString(),
  };
}
