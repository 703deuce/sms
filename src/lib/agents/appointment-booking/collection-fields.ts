/**
 * Custom fields Amy must collect during booking — agent-instance config, not company brain.
 */

export type CollectionFieldType =
  | "text"
  | "phone"
  | "email"
  | "number"
  | "date"
  | "time"
  | "address"
  | "single_select"
  | "multi_select"
  | "boolean";

export type CollectionFieldSaveTarget = "contact" | "appointment";

export type AgentCollectionField = {
  id: string;
  /** Stable key used in booking conversation state collectedFields */
  key: string;
  label: string;
  /** Exact question Amy asks the caller */
  question?: string;
  description?: string;
  type: CollectionFieldType;
  required: boolean;
  enabled: boolean;
  askOrder: number;
  options?: string[];
  confirmationRequired: boolean;
  sensitive: boolean;
  appliesToServiceIds?: string[];
  appliesToLocationIds?: string[];
  validationRules?: Record<string, unknown>;
  /** Where the captured value is stored */
  saveTo?: CollectionFieldSaveTarget[];
};

/** Wizard-compatible slim shape (legacy collectFields). */
export type WizardCollectField = {
  id: string;
  label: string;
  required: boolean;
  enabled: boolean;
  key?: string;
  question?: string;
  type?: CollectionFieldType;
  askOrder?: number;
  confirmationRequired?: boolean;
  sensitive?: boolean;
  description?: string;
  options?: string[];
  appliesToServiceIds?: string[];
  appliesToLocationIds?: string[];
  saveTo?: CollectionFieldSaveTarget[];
};

export const DEFAULT_COLLECTION_FIELDS: AgentCollectionField[] = [
  {
    id: "full_name",
    key: "customer_name",
    label: "Full name",
    question: "May I have your full name?",
    type: "text",
    required: true,
    enabled: true,
    askOrder: 1,
    confirmationRequired: true,
    sensitive: false,
    saveTo: ["contact", "appointment"],
  },
  {
    id: "phone",
    key: "callback_phone",
    label: "Callback number",
    question: "What's the best number to reach you?",
    type: "phone",
    required: true,
    enabled: true,
    askOrder: 2,
    confirmationRequired: true,
    sensitive: false,
    saveTo: ["contact", "appointment"],
  },
  {
    id: "service",
    key: "service_requested",
    label: "Service requested",
    question: "What service do you need?",
    type: "text",
    required: true,
    enabled: true,
    askOrder: 3,
    confirmationRequired: true,
    sensitive: false,
    saveTo: ["appointment"],
  },
  {
    id: "email",
    key: "email",
    label: "Email",
    question: "What's your email address?",
    type: "email",
    required: false,
    enabled: true,
    askOrder: 4,
    confirmationRequired: false,
    sensitive: false,
    saveTo: ["contact", "appointment"],
  },
  {
    id: "address",
    key: "service_address",
    label: "Service address",
    question: "What address should the technician come to?",
    type: "address",
    required: false,
    enabled: false,
    askOrder: 5,
    confirmationRequired: true,
    sensitive: false,
    saveTo: ["contact", "appointment"],
  },
  {
    id: "notes",
    key: "problem_description",
    label: "Additional notes",
    question: "Is there anything else I should note for the appointment?",
    type: "text",
    required: false,
    enabled: true,
    askOrder: 6,
    confirmationRequired: false,
    sensitive: false,
    saveTo: ["appointment"],
  },
];

function defaultQuestionFor(label: string, type: CollectionFieldType): string {
  if (type === "email") return `What's your ${label.toLowerCase()}?`;
  if (type === "phone") return `What's the best ${label.toLowerCase()}?`;
  if (type === "address") return `What address should we use for ${label.toLowerCase()}?`;
  return `Could you tell me your ${label.toLowerCase()}?`;
}

export function toAgentCollectionField(
  field: WizardCollectField,
  index = 0,
): AgentCollectionField {
  const type = field.type || inferTypeFromId(field.id);
  return {
    id: field.id,
    key: field.key || field.id,
    label: field.label,
    question: field.question || defaultQuestionFor(field.label, type),
    description: field.description,
    type,
    required: Boolean(field.required),
    enabled: field.enabled !== false,
    askOrder: field.askOrder ?? index + 1,
    options: field.options,
    confirmationRequired: field.confirmationRequired ?? Boolean(field.required),
    sensitive: Boolean(field.sensitive),
    appliesToServiceIds: field.appliesToServiceIds,
    appliesToLocationIds: field.appliesToLocationIds,
    saveTo: field.saveTo || ["contact", "appointment"],
  };
}

function inferTypeFromId(id: string): CollectionFieldType {
  if (id.includes("phone")) return "phone";
  if (id.includes("email")) return "email";
  if (id.includes("address")) return "address";
  if (id.includes("date")) return "date";
  if (id.includes("time")) return "time";
  return "text";
}

export function normalizeWizardCollectFields(
  fields: WizardCollectField[] | undefined,
): AgentCollectionField[] {
  if (!fields?.length) return DEFAULT_COLLECTION_FIELDS.map((f) => ({ ...f }));
  return fields
    .map((f, i) => toAgentCollectionField(f, i))
    .sort((a, b) => a.askOrder - b.askOrder);
}

export function createCustomCollectionField(input: {
  label: string;
  type?: CollectionFieldType;
  required?: boolean;
  askOrder?: number;
  question?: string;
  confirmationRequired?: boolean;
  appliesToServiceIds?: string[];
  appliesToLocationIds?: string[];
  saveTo?: CollectionFieldSaveTarget[];
}): AgentCollectionField {
  const label = input.label.trim() || "Custom field";
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "custom_field";
  const id = `custom_${key}_${Date.now().toString(36)}`;
  const type = input.type || "text";
  return {
    id,
    key,
    label,
    question: input.question || defaultQuestionFor(label, type),
    type,
    required: Boolean(input.required),
    enabled: true,
    askOrder: input.askOrder ?? 99,
    confirmationRequired: input.confirmationRequired ?? Boolean(input.required),
    sensitive: false,
    appliesToServiceIds: input.appliesToServiceIds,
    appliesToLocationIds: input.appliesToLocationIds,
    saveTo: input.saveTo || ["contact", "appointment"],
  };
}
