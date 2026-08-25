/** Canonical statuses returned to voice agents — never raw provider states. */
export type AgentToolStatus =
  | "confirmed"
  | "pending"
  | "failed"
  | "not_found"
  | "already_completed"
  | "available"
  | "unavailable";

export type AgentToolErrorCode =
  | "INVALID_INPUT"
  | "SLOT_UNAVAILABLE"
  | "SLOT_NOT_IN_AVAILABILITY"
  | "MISSING_REQUIRED_FIELD"
  | "CUSTOMER_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "TEMPORARY_PROVIDER_ERROR"
  | "POLICY_BLOCKED"
  | "ALREADY_COMPLETED"
  | "INTERNAL_ERROR";

export type AgentToolResult<T = Record<string, unknown>> = {
  success: boolean;
  status: AgentToolStatus;
  data: T;
  user_message: string | null;
  speak: string | null;
  retryable: boolean;
  error_code: AgentToolErrorCode | null;
  operation_id: string | null;
  /** Legacy compat for Telnyx handlers expecting ok */
  ok: boolean;
};

export type AgentToolContext = {
  workspaceId: string;
  agentId?: string;
  callId?: string;
};

export type CanonicalBookInput = {
  operation_id: string;
  service_name: string;
  start_time: string;
  timezone: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  contact_id?: string | null;
  address?: string | null;
};

export type CanonicalAvailabilityInput = {
  service_name: string;
  start_time?: string | null;
  end_time?: string | null;
  resolved_time?: string | null;
  days_ahead?: number | null;
  timezone?: string | null;
};

export type AvailabilitySlot = {
  start_time: string;
  label?: string;
};
