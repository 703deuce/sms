import type { RealEstateFieldDefinition, RealEstateIntent } from "./types";
import {
  TEMPLATE_GENERAL_FIELDS,
  TEMPLATE_INTENT_FIELD_CATALOG,
} from "./templates/definitions";
import type { RealEstateFieldManifest } from "./compile/field-manifest";

/** Session-scoped field manifest — set at call start from compiled agent config. */
let activeFieldManifest: RealEstateFieldManifest | null = null;

export function setActiveFieldManifest(manifest: RealEstateFieldManifest | null): void {
  activeFieldManifest = manifest;
}

export function getActiveFieldManifest(): RealEstateFieldManifest | null {
  return activeFieldManifest;
}

/** Build manifest map from compiled intent configs keyed by runtime intent. */
export function manifestFromCompiledIntents(
  intents: Partial<
    Record<RealEstateIntent, { enabled: boolean; fields: RealEstateFieldDefinition[] }>
  >,
): RealEstateFieldManifest {
  const manifest: RealEstateFieldManifest = {};
  for (const [intent, cfg] of Object.entries(intents) as [
    RealEstateIntent,
    { enabled: boolean; fields: RealEstateFieldDefinition[] },
  ][]) {
    if (cfg?.enabled && cfg.fields?.length) {
      manifest[intent] = cfg.fields;
    }
  }
  return manifest;
}

function resolveFieldsForIntent(intent: RealEstateIntent): RealEstateFieldDefinition[] {
  if (activeFieldManifest?.[intent]?.length) {
    return activeFieldManifest[intent]!;
  }
  return TEMPLATE_INTENT_FIELD_CATALOG[intent] || TEMPLATE_GENERAL_FIELDS;
}

export function fieldsForIntent(intent: RealEstateIntent): RealEstateFieldDefinition[] {
  return resolveFieldsForIntent(intent);
}

export function fieldsForIntents(intents: RealEstateIntent[]): RealEstateFieldDefinition[] {
  const seen = new Set<string>();
  const merged: RealEstateFieldDefinition[] = [];
  for (const intent of intents) {
    for (const field of resolveFieldsForIntent(intent)) {
      if (seen.has(field.field_id)) continue;
      seen.add(field.field_id);
      merged.push(field);
    }
  }
  return merged;
}

export function missingRequiredFields(
  intents: RealEstateIntent[],
  collected: Record<string, string>,
): RealEstateFieldDefinition[] {
  return fieldsForIntents(intents).filter(
    (field) => field.required && !collected[field.field_id]?.trim(),
  );
}

export function isIntakeComplete(
  intents: RealEstateIntent[],
  collected: Record<string, string>,
): boolean {
  if (!intents.length) return false;
  return missingRequiredFields(intents, collected).length === 0;
}

export function isIntentEnabled(intent: RealEstateIntent): boolean {
  if (!activeFieldManifest) return true;
  return Boolean(activeFieldManifest[intent]?.length);
}

export function normalizeIntent(raw: string): RealEstateIntent | null {
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, RealEstateIntent> = {
    buyer: "buyer",
    buy: "buyer",
    buying: "buyer",
    home_buyer: "buyer",
    buyer_lead: "buyer",
    seller: "seller",
    sell: "seller",
    selling: "seller",
    home_seller: "seller",
    seller_lead: "seller",
    showing: "showing",
    tour: "showing",
    property_showing: "showing",
    schedule_showing: "showing",
    showing_request: "showing",
    property_inquiry: "buyer",
    existing_client: "existing_client",
    existing: "existing_client",
    client: "existing_client",
    current_client: "existing_client",
    agent_to_agent: "agent_to_agent",
    agent: "agent_to_agent",
    realtor: "agent_to_agent",
    broker: "agent_to_agent",
    general: "general",
    other: "general",
    inquiry: "general",
    general_call: "general",
  };
  return aliases[value] || null;
}

/** Re-export template catalog for tests and compile layer. */
export { TEMPLATE_INTENT_FIELD_CATALOG };
