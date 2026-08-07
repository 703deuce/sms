/** How aggressively Amy should collect a field for a workflow. */
export type FieldCollectionMode = "required" | "optional" | "preferred" | "dont_ask";

export type FieldValueSource =
  | "caller"
  | "caller_id"
  | "contact"
  | "crm"
  | "tool"
  | "inferred";

export type WorkflowAction =
  | "general"
  | "book_appointment"
  | "request_quote"
  | "leave_message"
  | "emergency_service";

export type StandardFieldId =
  | "full_name"
  | "phone"
  | "email"
  | "address"
  | "service"
  | "message"
  | "problem_description"
  | string;

export type FieldRequirement = {
  field_id: StandardFieldId;
  label: string;
  mode: FieldCollectionMode;
  type: "text" | "phone" | "email" | "address" | "number" | "boolean";
  ask_prompt?: string;
  /** Arg keys that satisfy this field (tool payloads + collected state keys) */
  aliases: string[];
  custom?: boolean;
};

export type CollectedFieldEntry = {
  value: string | number | boolean | null;
  source: FieldValueSource;
  updated_at: string;
};

export type CustomerCollectedState = {
  fields: Record<string, CollectedFieldEntry>;
  custom_fields: Record<string, CollectedFieldEntry>;
  active_workflow?: WorkflowAction;
  updated_at: string;
};

export type CustomerCompletenessResult = {
  complete: boolean;
  workflow: WorkflowAction;
  missing_required_fields: string[];
  missing_preferred_fields: string[];
  satisfied_fields: string[];
  collected: Record<string, CollectedFieldEntry | null>;
  speak: string | null;
  field_submission_hints?: import("./field-hints").FieldSubmissionHint[];
};

export type NormalizedCustomerPayload = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  company?: string | null;
  message?: string | null;
  problem_description?: string | null;
  notes?: string | null;
  service_name?: string | null;
  custom_fields?: Record<string, unknown>;
  workflow?: WorkflowAction;
};
