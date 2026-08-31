/**
 * Data adapter: maps /api/contacts/fields ↔ Kimi contacts-fields mock types.
 */
import type { CustomFieldDefinition } from "@/lib/contacts/custom-fields";
import type { CustomField, FieldType } from "@/components/kimi/contacts-fields/mock-data";
import { mergeTagFor } from "@/components/kimi/contacts-fields/mock-data";

function mapFieldType(type: string): FieldType {
  const t = type.toLowerCase();
  if (t === "number") return "Number";
  if (t === "date") return "Date";
  if (t.includes("yes") || t.includes("bool")) return "Yes / No";
  return "Text";
}

export function mapDefinitionToKimi(def: CustomFieldDefinition, index: number): CustomField {
  return {
    id: def.key || `f${index}`,
    name: def.name,
    created: def.system ? "System field" : "Custom field",
    description: def.usedIn || "",
    mergeTag: mergeTagFor(def.name),
    type: mapFieldType(def.type),
  };
}

export function mapKimiToDefinition(field: CustomField): CustomFieldDefinition {
  const type =
    field.type === "Number"
      ? "Number"
      : field.type === "Date"
        ? "Date"
        : field.type === "Yes / No"
          ? "Yes/No"
          : "Text";
  const key = field.mergeTag.replace(/^\{\{|\}\}$/g, "");
  return {
    key,
    name: field.name,
    type,
    required: false,
    usedIn: field.description || "Merge tags, segments",
    system: false,
  };
}

export async function fetchCustomFields(): Promise<CustomFieldDefinition[]> {
  const res = await fetch("/api/contacts/fields");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load custom fields");
  return json.data?.fields || [];
}

export async function persistCustomFields(fields: CustomFieldDefinition[]): Promise<CustomFieldDefinition[]> {
  const res = await fetch("/api/contacts/fields", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not save custom fields");
  return json.data?.fields || [];
}
