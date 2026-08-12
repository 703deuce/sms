import type { RealEstateFieldDefinition, RealEstateIntent } from "./types";
import type { CompiledRealEstateFrontDesk } from "./compile/types";
import {
  TEMPLATE_GENERAL_FIELDS,
  TEMPLATE_INTENT_FIELD_CATALOG,
} from "./templates/definitions";
import type { RealEstateFieldManifest } from "./compile/field-manifest";

/** Session-scoped field manifest — set at call start from compiled agent config. */
let activeFieldManifest: RealEstateFieldManifest | null = null;

/** Session-scoped intent enablement — separate from field manifest length. */
let activeCompiledIntents: Partial<
  Record<RealEstateIntent, { enabled: boolean }>
> | null = null;

export function setActiveFieldManifest(manifest: RealEstateFieldManifest | null): void {
  activeFieldManifest = manifest;
}

export function setActiveCompiledIntents(
  intents: Partial<Record<RealEstateIntent, { enabled: boolean }>> | null,
): void {
  activeCompiledIntents = intents;
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

const FOLLOW_UP_OUTCOMES = new Set(["notify", "message"]);

/** Contact fields required before notify/message outcomes (seller follow-up, etc.). */
export function missingContactFollowUpFields(
  intents: RealEstateIntent[],
  collected: Record<string, string>,
  compiled?: CompiledRealEstateFrontDesk | null,
): RealEstateFieldDefinition[] {
  const needsFollowUp = intents.some((intent) => {
    if (compiled?.intents?.[intent]) {
      const cfg = compiled.intents[intent];
      return cfg.enabled && FOLLOW_UP_OUTCOMES.has(cfg.qualifiedOutcome);
    }
    return intent === "seller" || intent === "general" || intent === "agent_to_agent" || intent === "existing_client";
  });
  if (!needsFollowUp) return [];

  const all = fieldsForIntents(intents);
  const missing: RealEstateFieldDefinition[] = [];
  const pushIfMissing = (fieldId: string) => {
    if (collected[fieldId]?.trim()) return;
    const field = all.find((f) => f.field_id === fieldId);
    if (field && !missing.some((f) => f.field_id === fieldId)) {
      missing.push(field);
    }
  };

  pushIfMissing("preferred_contact_method");
  pushIfMissing("email");
  if (!collected.callback_phone?.trim()) {
    pushIfMissing("callback_phone");
  }

  return missing;
}

export function missingIntakeFields(
  intents: RealEstateIntent[],
  collected: Record<string, string>,
  compiled?: CompiledRealEstateFrontDesk | null,
): RealEstateFieldDefinition[] {
  const required = missingRequiredFields(intents, collected);
  const contact = missingContactFollowUpFields(intents, collected, compiled);
  const seen = new Set(required.map((f) => f.field_id));
  const merged = [...required];
  for (const field of contact) {
    if (!seen.has(field.field_id)) {
      merged.push(field);
      seen.add(field.field_id);
    }
  }
  return merged;
}

export function isIntakeComplete(
  intents: RealEstateIntent[],
  collected: Record<string, string>,
): boolean {
  if (!intents.length) return false;
  return missingRequiredFields(intents, collected).length === 0;
}

export function isIntentEnabled(intent: RealEstateIntent): boolean {
  if (activeCompiledIntents) {
    const cfg = activeCompiledIntents[intent];
    if (cfg !== undefined) return cfg.enabled;
  }
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
