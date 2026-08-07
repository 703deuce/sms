/**
 * Canonical Transovo workflow DSL — the runtime executes this, not LLM prose.
 */
export type WorkflowNodeType =
  | "incoming_call"
  | "missed_call"
  | "sms_received"
  | "manual_start"
  | "lookup_customer"
  | "collect_field"
  | "record_field"
  | "set_variable"
  | "if"
  | "business_hours"
  | "field_equals"
  | "customer_exists"
  | "integration_available"
  | "check_availability"
  | "hold_slot"
  | "confirm_booking"
  | "find_appointment"
  | "reschedule"
  | "cancel"
  | "send_sms"
  | "send_email"
  | "transfer"
  | "escalate"
  | "take_message"
  | "end_call"
  | "wait"
  | "branch"
  | "retry"
  | "fallback"
  | "end";

export type WorkflowFailureRoute = {
  error_code: string;
  next_node_id: string;
};

export type CanonicalWorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  version: number;
  config: Record<string, unknown>;
  next?: string | null;
  on_failure?: WorkflowFailureRoute[];
};

export type CanonicalWorkflowSpec = {
  workflow_id: string;
  version: number;
  entry_node: string;
  nodes: CanonicalWorkflowNode[];
  metadata?: {
    change_request_id?: string;
    created_by?: string;
    candidate?: boolean;
  };
};

export type WorkflowValidationError = {
  code: string;
  message: string;
  node_id?: string;
};

export type WorkflowValidationResult = {
  valid: boolean;
  errors: WorkflowValidationError[];
  warnings: WorkflowValidationError[];
};
