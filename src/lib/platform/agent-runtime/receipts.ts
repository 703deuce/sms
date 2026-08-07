import { createId } from "@/lib/supabase/id";
import type { AgentRole, OperationStatus, PlatformOperationReceipt } from "./types";

export function newOperationId(prefix = "op"): string {
  return `${prefix}_${createId()}`;
}

export function createReceipt(input: {
  operation_id?: string;
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
  error_code?: string | null;
  metadata?: Record<string, unknown>;
}): PlatformOperationReceipt {
  const now = new Date().toISOString();
  return {
    operation_id: input.operation_id || newOperationId(),
    type: input.type,
    status: input.status,
    agent_role: input.agent_role,
    tenant_id: input.tenant_id,
    user_id: input.user_id ?? null,
    agent_id: input.agent_id ?? null,
    workflow_id: input.workflow_id ?? null,
    change_request_id: input.change_request_id ?? null,
    old_version: input.old_version ?? null,
    new_version: input.new_version ?? null,
    error_code: input.error_code ?? null,
    created_at: now,
    completed_at: ["confirmed", "published", "rollback_completed", "tests_passed", "failed"].includes(
      input.status,
    )
      ? now
      : null,
    metadata: input.metadata,
  };
}

export function appendReceipt(
  receipts: PlatformOperationReceipt[],
  receipt: PlatformOperationReceipt,
): PlatformOperationReceipt[] {
  const idx = receipts.findIndex((r) => r.operation_id === receipt.operation_id);
  if (idx >= 0) {
    const next = [...receipts];
    next[idx] = { ...next[idx], ...receipt, completed_at: receipt.completed_at || next[idx].completed_at };
    return next;
  }
  return [...receipts, receipt];
}
