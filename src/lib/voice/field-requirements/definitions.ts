import type { FieldRequirement, StandardFieldId, WorkflowAction } from "./types";

/** Canonical standard fields — custom fields extend this at runtime. */
export const STANDARD_FIELD_CATALOG: Record<
  string,
  Omit<FieldRequirement, "mode">
> = {
  full_name: {
    field_id: "full_name",
    label: "Name",
    type: "text",
    ask_prompt: "May I have your name?",
    aliases: [
      "name",
      "customerName",
      "customer_name",
      "full_name",
      "caller_name",
      "first_name",
    ],
  },
  phone: {
    field_id: "phone",
    label: "Phone number",
    type: "phone",
    ask_prompt: "What's the best number to reach you?",
    aliases: ["phone", "customerPhone", "customer_phone", "callback_phone"],
  },
  email: {
    field_id: "email",
    label: "Email",
    type: "email",
    ask_prompt: "What's the best email for you?",
    aliases: ["email", "customerEmail", "customer_email"],
  },
  address: {
    field_id: "address",
    label: "Service address",
    type: "address",
    ask_prompt: "What address should we come to?",
    aliases: ["address", "service_address", "location"],
  },
  service: {
    field_id: "service",
    label: "Service requested",
    type: "text",
    ask_prompt: "What service do you need?",
    aliases: ["serviceName", "service", "service_name", "appointmentType"],
  },
  message: {
    field_id: "message",
    label: "Message",
    type: "text",
    ask_prompt: "What message should I pass along?",
    aliases: ["message", "reason", "notes", "body"],
  },
  problem_description: {
    field_id: "problem_description",
    label: "Issue or problem description",
    type: "text",
    ask_prompt: "Can you describe the problem or issue?",
    aliases: [
      "problem_description",
      "problem",
      "issue",
      "notes",
      "description",
      "additional_notes",
    ],
  },
  /** Wizard collectFields id for notes — same canonical meaning as problem_description */
  notes: {
    field_id: "notes",
    label: "Additional notes",
    type: "text",
    ask_prompt: "Is there anything else I should note about the problem?",
    aliases: [
      "notes",
      "problem_description",
      "problem",
      "issue",
      "description",
      "additional_notes",
    ],
  },
};

/** Baseline when no tenant/service override exists. */
export const WORKFLOW_DEFAULT_REQUIRED: Record<WorkflowAction, StandardFieldId[]> = {
  general: ["full_name", "phone"],
  book_appointment: ["full_name", "phone"],
  request_quote: ["full_name", "phone", "address"],
  leave_message: ["full_name", "phone", "message"],
  emergency_service: ["full_name", "phone", "address", "problem_description"],
};

export function catalogField(
  fieldId: string,
  mode: FieldRequirement["mode"],
  overrides?: Partial<FieldRequirement>,
): FieldRequirement {
  const base = STANDARD_FIELD_CATALOG[fieldId];
  if (base) {
    return { ...base, mode, ...overrides, field_id: fieldId };
  }
  return {
    field_id: fieldId,
    label: overrides?.label || fieldId.replace(/_/g, " "),
    type: overrides?.type || "text",
    mode,
    ask_prompt: overrides?.ask_prompt || `Could you share your ${fieldId.replace(/_/g, " ")}?`,
    aliases: overrides?.aliases || [fieldId],
    custom: true,
    ...overrides,
  };
}
