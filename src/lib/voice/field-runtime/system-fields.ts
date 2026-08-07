import type { BuilderFieldType, WorkflowFieldDefinition } from "./types";

/** Canonical system field ids — stable across all tenants. */
export const SYSTEM_FIELD_IDS = {
  name: "sys_name",
  phone: "sys_phone",
  email: "sys_email",
  address: "sys_address",
  service: "sys_service",
  message: "sys_message",
} as const;

const LEGACY_TO_SYSTEM: Record<string, { field_id: string; system_key: string; type: BuilderFieldType }> = {
  full_name: { field_id: SYSTEM_FIELD_IDS.name, system_key: "name", type: "text" },
  name: { field_id: SYSTEM_FIELD_IDS.name, system_key: "name", type: "text" },
  phone: { field_id: SYSTEM_FIELD_IDS.phone, system_key: "phone", type: "phone" },
  email: { field_id: SYSTEM_FIELD_IDS.email, system_key: "email", type: "email" },
  address: { field_id: SYSTEM_FIELD_IDS.address, system_key: "address", type: "address" },
  service_address: { field_id: SYSTEM_FIELD_IDS.address, system_key: "address", type: "address" },
  service: { field_id: SYSTEM_FIELD_IDS.service, system_key: "service", type: "text" },
  serviceName: { field_id: SYSTEM_FIELD_IDS.service, system_key: "service", type: "text" },
  message: { field_id: SYSTEM_FIELD_IDS.message, system_key: "message", type: "long_text" },
  notes: { field_id: "fld_notes", system_key: "notes", type: "long_text" },
  problem_description: { field_id: "fld_notes", system_key: "notes", type: "long_text" },
};

export function toCustomFieldId(rawId: string): string {
  const id = rawId.trim();
  if (!id) return id;
  if (id.startsWith("fld_") || id.startsWith("sys_")) return id;
  return `fld_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export function legacyIdToFieldDefinition(input: {
  id: string;
  label: string;
  type?: string;
  required: boolean;
  enabled?: boolean;
  question?: string;
  options?: string[];
  askOrder?: number;
}): WorkflowFieldDefinition {
  const mapped = LEGACY_TO_SYSTEM[input.id];
  if (mapped) {
    return {
      field_id: mapped.field_id,
      label: input.label,
      type: (input.type as BuilderFieldType) || mapped.type,
      required: Boolean(input.required && input.enabled !== false),
      collection_instruction:
        input.question || defaultInstruction(input.label, mapped.type),
      kind: mapped.field_id.startsWith("sys_") ? "system" : "custom",
      system_key: mapped.system_key,
      options: input.options,
      enabled: input.enabled !== false,
      ask_order: input.askOrder,
    };
  }
  return {
    field_id: toCustomFieldId(input.id),
    label: input.label,
    type: (input.type as BuilderFieldType) || "text",
    required: Boolean(input.required && input.enabled !== false),
    collection_instruction:
      input.question || defaultInstruction(input.label, "text"),
    kind: "custom",
    options: input.options,
    enabled: input.enabled !== false,
    ask_order: input.askOrder,
  };
}

function defaultInstruction(label: string, type: BuilderFieldType): string {
  if (type === "phone") return `Ask for the caller's ${label.toLowerCase()}.`;
  if (type === "email") return `Ask for the caller's ${label.toLowerCase()}.`;
  if (type === "address") return `Ask for the ${label.toLowerCase()}.`;
  return `Ask for ${label.toLowerCase()}.`;
}

export function systemFieldValueForBooking(
  fields: Record<string, { value?: unknown }>,
): {
  name: string;
  phone: string;
  email: string;
  address: string;
  serviceName: string;
} {
  const get = (id: string) => {
    const v = fields[id]?.value;
    return v != null && String(v).trim() !== "" ? String(v).trim() : "";
  };
  return {
    name: get(SYSTEM_FIELD_IDS.name),
    phone: get(SYSTEM_FIELD_IDS.phone),
    email: get(SYSTEM_FIELD_IDS.email),
    address: get(SYSTEM_FIELD_IDS.address),
    serviceName: get(SYSTEM_FIELD_IDS.service),
  };
}
