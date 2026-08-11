import type { RealtorIntentConfig, RealtorIntentFieldToggle } from "./types";
import type { RealEstateIntent } from "@/lib/voice/real-estate/types";
import { TEMPLATE_INTENT_FIELD_CATALOG } from "@/lib/voice/real-estate/templates/definitions";

/** Merge template catalog fields with customer toggles for the field editor UI. */
export function mergeIntentFieldToggles(
  intent: RealEstateIntent,
  config: RealtorIntentConfig,
): RealtorIntentFieldToggle[] {
  const catalog = TEMPLATE_INTENT_FIELD_CATALOG[intent] || [];
  const byId = new Map(config.fields.map((f) => [f.fieldId, f]));
  const merged: RealtorIntentFieldToggle[] = [];

  for (const base of catalog) {
    const existing = byId.get(base.field_id);
    merged.push(
      existing || {
        fieldId: base.field_id,
        enabled: true,
        required: base.required,
        label: base.label,
        instruction: base.collection_instruction,
      },
    );
    byId.delete(base.field_id);
  }

  for (const custom of byId.values()) {
    merged.push({ ...custom, custom: custom.custom ?? true });
  }

  return merged.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function updateIntentFieldToggle(
  config: RealtorIntentConfig,
  fieldId: string,
  patch: Partial<RealtorIntentFieldToggle>,
): RealtorIntentConfig {
  const fields = [...config.fields];
  const idx = fields.findIndex((f) => f.fieldId === fieldId);
  if (idx >= 0) {
    fields[idx] = { ...fields[idx], ...patch };
  } else {
    fields.push({ fieldId, enabled: true, required: false, ...patch, custom: patch.custom ?? true });
  }
  return { ...config, fields };
}

export function addCustomIntentField(
  config: RealtorIntentConfig,
  input: { fieldId: string; label: string; required?: boolean; question?: string },
): RealtorIntentConfig {
  const fieldId = input.fieldId.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!fieldId) return config;
  if (config.fields.some((f) => f.fieldId === fieldId)) return config;
  return {
    ...config,
    fields: [
      ...config.fields,
      {
        fieldId,
        label: input.label.trim() || fieldId,
        question: input.question?.trim(),
        enabled: true,
        required: input.required ?? true,
        custom: true,
        order: config.fields.length + 1,
      },
    ],
  };
}

export function reorderIntentFields(
  config: RealtorIntentConfig,
  fieldIds: string[],
): RealtorIntentConfig {
  const byId = new Map(config.fields.map((f) => [f.fieldId, f]));
  const reordered = fieldIds
    .map((id, index) => {
      const field = byId.get(id);
      return field ? { ...field, order: index + 1 } : null;
    })
    .filter(Boolean) as RealtorIntentFieldToggle[];
  for (const field of config.fields) {
    if (!reordered.some((f) => f.fieldId === field.fieldId)) {
      reordered.push(field);
    }
  }
  return { ...config, fields: reordered };
}
