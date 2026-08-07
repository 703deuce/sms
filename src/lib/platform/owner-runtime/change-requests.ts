/**
 * Structured change requests — the contract between Owner Amy and Workflow Architect.
 * Owner Amy never mutates config directly; she creates these records.
 */
import { createId } from "@/lib/supabase/id";

export type ChangeRequestIntent =
  | "update_field_requirement"
  | "change_delay"
  | "create_workflow"
  | "update_workflow"
  | "update_booking_policy"
  | "update_transfer_rule"
  | "enable_feature"
  | "disable_feature";

export type FieldRequirementChange = {
  field_id: string;
  required: boolean;
  service_id?: string | null;
};

export type StructuredChangeRequest = {
  change_request_id: string;
  tenant_id: string;
  requested_by_user_id: string;
  target_agent_id: string;
  target_workflow_id?: string | null;
  intent: ChangeRequestIntent;
  reason: string;
  changes:
    | FieldRequirementChange[]
    | { delay_seconds: number }
    | { goal: string; constraints?: Record<string, unknown> }
    | Record<string, unknown>;
  status: "draft" | "submitted" | "architect_pending" | "candidate_ready" | "tests_passed" | "published" | "rejected" | "failed";
  candidate_version?: number | null;
  created_at: string;
  updated_at: string;
  operation_id?: string;
};

export function createStructuredChangeRequest(input: {
  tenant_id: string;
  requested_by_user_id: string;
  target_agent_id: string;
  intent: ChangeRequestIntent;
  reason: string;
  changes: StructuredChangeRequest["changes"];
  target_workflow_id?: string | null;
}): StructuredChangeRequest {
  const now = new Date().toISOString();
  return {
    change_request_id: `chg_${createId()}`,
    tenant_id: input.tenant_id,
    requested_by_user_id: input.requested_by_user_id,
    target_agent_id: input.target_agent_id,
    target_workflow_id: input.target_workflow_id ?? null,
    intent: input.intent,
    reason: input.reason,
    changes: input.changes,
    status: "submitted",
    created_at: now,
    updated_at: now,
  };
}

/** Build a field requirement change from natural-language owner intent. */
export function buildFieldRequirementChangeRequest(input: {
  tenant_id: string;
  user_id: string;
  agent_id: string;
  workflow_id?: string;
  field_id: string;
  required: boolean;
  reason: string;
}): StructuredChangeRequest {
  return createStructuredChangeRequest({
    tenant_id: input.tenant_id,
    requested_by_user_id: input.user_id,
    target_agent_id: input.agent_id,
    target_workflow_id: input.workflow_id,
    intent: "update_field_requirement",
    reason: input.reason,
    changes: [{ field_id: input.field_id, required: input.required }],
  });
}

/** Contract: Owner Amy → Workflow Architect */
export type ArchitectBuildRequest = {
  request_type: "workflow_change" | "workflow_create";
  change_request_id: string;
  tenant_id: string;
  target_agent_id: string;
  target_workflow_id?: string | null;
  goal: string;
  constraints?: Record<string, unknown>;
  current_workflow_version?: number | null;
};

export function toArchitectBuildRequest(
  change: StructuredChangeRequest,
): ArchitectBuildRequest {
  const changes = change.changes as Record<string, unknown>;
  return {
    request_type: change.intent === "create_workflow" ? "workflow_create" : "workflow_change",
    change_request_id: change.change_request_id,
    tenant_id: change.tenant_id,
    target_agent_id: change.target_agent_id,
    target_workflow_id: change.target_workflow_id,
    goal: change.reason,
    constraints: "constraints" in changes ? (changes.constraints as Record<string, unknown>) : undefined,
    current_workflow_version: null,
  };
}

/** Contract: Workflow Architect → Owner Amy / runtime */
export type ArchitectBuildResponse = {
  status: "candidate_ready" | "build_failed" | "capability_not_supported";
  candidate_version?: number;
  validation?: "passed" | "failed";
  tests?: { passed: number; failed: number };
  summary?: string[];
  error_code?: string;
  details?: Array<{ code: string; message: string; node_id?: string }>;
};
