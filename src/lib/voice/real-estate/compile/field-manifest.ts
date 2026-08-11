import type { RealtorIntentConfig, RealtorIntentFieldToggle } from "@/lib/realtor/types";
import type { RealEstateFieldDefinition, RealEstateIntent } from "../types";
import {
  FRONT_DESK_INTENT_KEY_TO_RUNTIME,
  TEMPLATE_INTENT_FIELD_CATALOG,
  type FrontDeskIntentConfigKey,
} from "../templates/definitions";

export type RealEstateFieldManifest = Partial<Record<RealEstateIntent, RealEstateFieldDefinition[]>>;

/** Resolve customer field toggles into runtime field definitions. */
export function resolveIntentFields(
  intent: RealEstateIntent,
  intentConfig: RealtorIntentConfig,
): RealEstateFieldDefinition[] {
  const catalog = TEMPLATE_INTENT_FIELD_CATALOG[intent] || [];
  const toggles = new Map<string, RealtorIntentFieldToggle>(
    intentConfig.fields.map((f) => [f.fieldId, f]),
  );

  const resolved: RealEstateFieldDefinition[] = [];
  const seen = new Set<string>();

  for (const base of catalog) {
    const toggle = toggles.get(base.field_id);
    if (toggle && !toggle.enabled) continue;

    const field: RealEstateFieldDefinition = {
      ...base,
      label: toggle?.label?.trim() || base.label,
      required: toggle ? toggle.required : base.required,
      collection_instruction:
        toggle?.question?.trim() ||
        toggle?.instruction?.trim() ||
        base.collection_instruction,
    };
    if (seen.has(field.field_id)) continue;
    seen.add(field.field_id);
    resolved.push(field);
  }

  for (const toggle of intentConfig.fields) {
    if (!toggle.enabled) continue;
    if (seen.has(toggle.fieldId)) continue;
    if (!toggle.custom) continue;
    resolved.push({
      field_id: toggle.fieldId,
      label: toggle.label?.trim() || toggle.fieldId,
      type:
        toggle.type === "currency_range" || toggle.type === "select"
          ? "text"
          : toggle.type || "text",
      required: toggle.required,
      collection_instruction:
        toggle.question?.trim() ||
        toggle.instruction?.trim() ||
        `Collect ${toggle.label || toggle.fieldId}.`,
    });
    seen.add(toggle.fieldId);
  }

  return resolved.sort((a, b) => {
    const orderA = intentConfig.fields.find((f) => f.fieldId === a.field_id)?.order ?? 999;
    const orderB = intentConfig.fields.find((f) => f.fieldId === b.field_id)?.order ?? 999;
    return orderA - orderB;
  });
}

export function buildFieldManifestFromFrontDeskConfig(
  frontDesk: Record<FrontDeskIntentConfigKey, RealtorIntentConfig>,
): RealEstateFieldManifest {
  const manifest: RealEstateFieldManifest = {};
  for (const [key, runtimeIntent] of Object.entries(FRONT_DESK_INTENT_KEY_TO_RUNTIME) as [
    FrontDeskIntentConfigKey,
    RealEstateIntent,
  ][]) {
    const cfg = frontDesk[key];
    if (!cfg?.enabled) continue;
    manifest[runtimeIntent] = resolveIntentFields(runtimeIntent, cfg);
  }
  return manifest;
}

export function isIntentEnabledInManifest(
  manifest: RealEstateFieldManifest | null | undefined,
  intent: RealEstateIntent,
): boolean {
  if (!manifest) return true;
  return Boolean(manifest[intent]?.length);
}
