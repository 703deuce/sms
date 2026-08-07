import type { RuntimeFieldManifestEntry, WorkflowAction } from "@/lib/voice/field-runtime/types";

/** Deterministic workflow phases for Caller Amy appointment booking. */
export type WorkflowState =
  | "INTENT_DISCOVERY"
  | "COLLECTING_FIELDS"
  | "CHECKING_AVAILABILITY"
  | "SELECTING_SLOT"
  | "READY_TO_BOOK"
  | "BOOKING_IN_PROGRESS"
  | "COMPLETE"
  | "GENERAL";

export type FieldReceipt = {
  receipt_id: string;
  field_id: string;
  value_hash: string;
  saved_at: string;
};

export type OperationReceipt = {
  operation_id: string;
  type: string;
  status: "pending" | "confirmed" | "failed" | "already_completed";
  provider?: string | null;
  provider_reference?: string | null;
  created_at: string;
  completed_at?: string | null;
  error_code?: string | null;
};

export type StateTransition = {
  from: WorkflowState;
  to: WorkflowState;
  at: string;
  reason: string;
};

/** Authoritative call runtime — survives LLM context loss. */
export type AgentRuntimeRecord = {
  workflow_id: WorkflowAction;
  workflow_version: string;
  state: WorkflowState;
  intent?: WorkflowAction | null;
  service_name?: string | null;
  field_receipts: FieldReceipt[];
  operation_receipts: OperationReceipt[];
  proposed_slots: string[];
  held_slot?: string | null;
  selected_slot?: string | null;
  booking_id?: string | null;
  pending_operations: string[];
  state_history: StateTransition[];
  updated_at: string;
};

export type RuntimeContextPayload = {
  workflow_id: WorkflowAction;
  workflow_version: string;
  state: WorkflowState;
  intent: WorkflowAction | null;
  service_name: string | null;
  allowed_tools: string[];
  current_field: RuntimeFieldManifestEntry | null;
  missing_fields: RuntimeFieldManifestEntry[];
  fields_to_collect: RuntimeFieldManifestEntry[];
  complete: boolean;
  known_fields: Record<string, string>;
  selected_slot: string | null;
  held_slot: string | null;
  booking_id: string | null;
  pending_operations: string[];
  speak: string | null;
};

export type ToolGuardResult = {
  allowed: boolean;
  state: WorkflowState;
  allowed_tools: string[];
  error_code?: string;
  speak?: string;
  retryable?: boolean;
  next_action?: string;
};
