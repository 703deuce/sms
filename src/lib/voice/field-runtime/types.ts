/** Field types the builder supports — validated on save. */
export type BuilderFieldType =
  | "text"
  | "long_text"
  | "number"
  | "phone"
  | "email"
  | "address"
  | "date"
  | "datetime"
  | "boolean"
  | "single_select"
  | "multi_select";

export type WorkflowAction =
  | "general"
  | "book_appointment"
  | "request_quote"
  | "leave_message"
  | "emergency_service";

export type FieldKind = "system" | "custom" | "derived";

/** Stored in agent/booking builder config. */
export type WorkflowFieldDefinition = {
  field_id: string;
  label: string;
  type: BuilderFieldType;
  required: boolean;
  collection_instruction: string;
  kind?: FieldKind;
  /** For system fields — maps to contact/appointment canonical keys */
  system_key?: string;
  options?: string[];
  enabled?: boolean;
  ask_order?: number;
};

/** What Amy receives at runtime — no aliases, no hardcoded names. */
export type RuntimeFieldManifestEntry = {
  field_id: string;
  label: string;
  type: BuilderFieldType;
  required: boolean;
  collection_instruction: string;
  options?: string[];
};

export type RuntimeFieldManifest = {
  workflow: WorkflowAction;
  service_name?: string | null;
  session_id: string;
  fields_to_collect: RuntimeFieldManifestEntry[];
};

export type FieldValueSource =
  | "caller"
  | "caller_id"
  | "contact"
  | "tool"
  | "derived";

export type CollectedFieldValue = {
  value: string | number | boolean | null;
  source: FieldValueSource;
  updated_at: string;
  label?: string;
};

export type WorkflowFieldSession = {
  session_id: string;
  workflow: WorkflowAction;
  service_name?: string | null;
  active_field?: string | null;
  fields: Record<string, CollectedFieldValue>;
  derived: Record<string, CollectedFieldValue>;
  updated_at: string;
};

export type WorkflowRequirementsResult = {
  workflow: WorkflowAction;
  session_id: string;
  complete: boolean;
  missing_fields: RuntimeFieldManifestEntry[];
  collected_field_ids: string[];
  active_field?: string | null;
  fields_to_collect: RuntimeFieldManifestEntry[];
  speak: string | null;
};
