export type CustomFieldDefinition = {
  key: string;
  name: string;
  type: string;
  required?: boolean;
  usedIn?: string;
  system?: boolean;
};

export const DEFAULT_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    key: "first_name",
    name: "First name",
    type: "Text",
    required: true,
    usedIn: "Merge tags, personalization",
    system: true,
  },
  {
    key: "last_name",
    name: "Last name",
    type: "Text",
    required: false,
    usedIn: "Merge tags, personalization",
    system: true,
  },
  {
    key: "company",
    name: "Company",
    type: "Text",
    required: false,
    usedIn: "Segments, merge tags",
    system: false,
  },
  {
    key: "birthday",
    name: "Birthday",
    type: "Date",
    required: false,
    usedIn: "Birthday automation trigger",
    system: false,
  },
  {
    key: "appointment_date",
    name: "Appointment date",
    type: "Date",
    required: false,
    usedIn: "Reminder campaigns",
    system: false,
  },
  {
    key: "customer_type",
    name: "Customer type",
    type: "Dropdown",
    required: false,
    usedIn: "Segments, reporting",
    system: false,
  },
  {
    key: "location",
    name: "Location",
    type: "Text",
    required: false,
    usedIn: "Geo-targeted campaigns",
    system: false,
  },
  {
    key: "last_purchase",
    name: "Last purchase",
    type: "Date",
    required: false,
    usedIn: "Re-engagement segments",
    system: false,
  },
];

export function parseCustomFieldsConfig(raw: unknown): CustomFieldDefinition[] {
  if (!Array.isArray(raw)) return DEFAULT_CUSTOM_FIELDS;
  const fields: CustomFieldDefinition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key || "").trim();
    const name = String(row.name || "").trim();
    if (!key || !name) continue;
    fields.push({
      key,
      name,
      type: String(row.type || "Text"),
      required: Boolean(row.required),
      usedIn: row.usedIn ? String(row.usedIn) : undefined,
      system: Boolean(row.system),
    });
  }
  return fields.length ? fields : DEFAULT_CUSTOM_FIELDS;
}

export function validateCustomFieldsPayload(fields: CustomFieldDefinition[]): CustomFieldDefinition[] {
  const seen = new Set<string>();
  const out: CustomFieldDefinition[] = [];
  for (const field of fields) {
    const key = field.key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      name: field.name.trim(),
      type: field.type || "Text",
      required: Boolean(field.required),
      usedIn: field.usedIn?.trim() || undefined,
      system: Boolean(field.system),
    });
  }
  const systemKeys = DEFAULT_CUSTOM_FIELDS.filter((f) => f.system).map((f) => f.key);
  for (const sys of DEFAULT_CUSTOM_FIELDS.filter((f) => f.system)) {
    if (!out.some((f) => f.key === sys.key)) {
      out.unshift(sys);
    }
  }
  for (const f of out) {
    if (systemKeys.includes(f.key)) f.system = true;
  }
  return out.length ? out : DEFAULT_CUSTOM_FIELDS;
}
