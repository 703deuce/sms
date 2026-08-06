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

export type AgentCollectionField = {
  id: string;
  /** Stable key used in booking conversation state collectedFields */
  key: string;
  label: string;
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
};

/** Wizard-compatible slim shape (legacy collectFields). */
export type WizardCollectField = {
  id: string;
  label: string;
  required: boolean;
  enabled: boolean;
  key?: string;
  type?: CollectionFieldType;
  askOrder?: number;
  confirmationRequired?: boolean;
  sensitive?: boolean;
  description?: string;
  options?: string[];
  appliesToServiceIds?: string[];
  appliesToLocationIds?: string[];
};

export const DEFAULT_COLLECTION_FIELDS: AgentCollectionField[] = [
  {
    id: "full_name",
    key: "customer_name",
    label: "Full name",
    type: "text",
    required: true,
    enabled: true,
    askOrder: 1,
    confirmationRequired: true,
    sensitive: false,
  },
  {
    id: "phone",
    key: "callback_phone",
    label: "Callback number",
    type: "phone",
    required: true,
    enabled: true,
    askOrder: 2,
    confirmationRequired: true,
    sensitive: false,
  },
  {
    id: "service",
    key: "service_requested",
    label: "Service requested",
    type: "text",
    required: true,
    enabled: true,
    askOrder: 3,
    confirmationRequired: true,
    sensitive: false,
  },
  {
    id: "email",
    key: "email",
    label: "Email",
    type: "email",
    required: false,
    enabled: true,
    askOrder: 4,
    confirmationRequired: false,
    sensitive: false,
  },
  {
    id: "address",
    key: "service_address",
    label: "Service address",
    type: "address",
    required: false,
    enabled: false,
    askOrder: 5,
    confirmationRequired: true,
    sensitive: false,
  },
  {
    id: "notes",
    key: "problem_description",
    label: "Additional notes",
    type: "text",
    required: false,
    enabled: true,
    askOrder: 6,
    confirmationRequired: false,
    sensitive: false,
  },
];

export function toAgentCollectionField(
  field: WizardCollectField,
  index = 0,
): AgentCollectionField {
  return {
    id: field.id,
    key: field.key || field.id,
    label: field.label,
    description: field.description,
    type: field.type || inferTypeFromId(field.id),
    required: Boolean(field.required),
    enabled: field.enabled !== false,
    askOrder: field.askOrder ?? index + 1,
    options: field.options,
    confirmationRequired: field.confirmationRequired ?? Boolean(field.required),
    sensitive: Boolean(field.sensitive),
    appliesToServiceIds: field.appliesToServiceIds,
    appliesToLocationIds: field.appliesToLocationIds,
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
}): AgentCollectionField {
  const label = input.label.trim() || "Custom field";
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "custom_field";
  const id = `custom_${key}_${Date.now().toString(36)}`;
  return {
    id,
    key,
    label,
    type: input.type || "text",
    required: Boolean(input.required),
    enabled: true,
    askOrder: input.askOrder ?? 99,
    confirmationRequired: Boolean(input.required),
    sensitive: false,
  };
}
