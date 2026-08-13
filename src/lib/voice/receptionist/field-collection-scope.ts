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

export function missingReceptionistFields(
  manifest: AgentFieldDefinition[],
  fields: Record<string, string> | undefined,
  purpose?: ReceptionistCollectionPurpose,
): AgentFieldDefinition[] {
  const scoped = receptionistFieldsForCollection(manifest, purpose);
  return scoped.filter((f) => !fields?.[f.id]?.trim());
}
