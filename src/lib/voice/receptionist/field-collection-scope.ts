import type { AgentFieldDefinition } from "./types";

export type ReceptionistCollectionPurpose = "message" | "service" | "booking" | "general";

/**
 * Which manifest fields the runtime should collect now — avoids email/address loops
 * during simple message-taking when those fields are optional.
 */
export function receptionistFieldsForCollection(
  manifest: AgentFieldDefinition[],
  purpose: ReceptionistCollectionPurpose = "general",
): AgentFieldDefinition[] {
  return manifest.filter((field) => {
    if (purpose === "message") {
      if (!field.required) return false;
      if (field.id === "email" || field.id === "address") return false;
      return true;
    }

    if (!field.required) {
      if (field.id === "email" || field.askWhen === "when_booking") {
        return purpose === "booking";
      }
      if (field.askWhen === "service_inquiry") {
        return purpose === "service" || purpose === "booking";
      }
      if (field.id === "reason") {
        return purpose === "service" || purpose === "booking";
      }
      return false;
    }

    return true;
  });
}

/** Collect problem/reason before profile fields when still missing. */
const COLLECTION_FIELD_ORDER: Record<string, number> = {
  reason: 0,
  name: 1,
  phone: 2,
  address: 3,
  email: 4,
};

export function sortReceptionistFieldsForCollection(
  fields: AgentFieldDefinition[],
): AgentFieldDefinition[] {
  return [...fields].sort(
    (a, b) => (COLLECTION_FIELD_ORDER[a.id] ?? 99) - (COLLECTION_FIELD_ORDER[b.id] ?? 99),
  );
}

export function missingReceptionistFields(
  manifest: AgentFieldDefinition[],
  fields: Record<string, string> | undefined,
  purpose?: ReceptionistCollectionPurpose,
): AgentFieldDefinition[] {
  const scoped = receptionistFieldsForCollection(manifest, purpose);
  const missing = scoped.filter((f) => !fields?.[f.id]?.trim());
  return sortReceptionistFieldsForCollection(missing);
}
