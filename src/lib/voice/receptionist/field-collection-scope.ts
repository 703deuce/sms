import type { AgentFieldDefinition } from "./types";
import { sortFieldsByManifestOrder } from "./field-manifest-runtime";

export type ReceptionistCollectionPurpose = "message" | "service" | "booking" | "general";

function fieldAppliesToPurpose(
  field: AgentFieldDefinition,
  purpose: ReceptionistCollectionPurpose,
): boolean {
  if (!field.required) {
    if (field.askWhen === "when_booking") {
      return purpose === "booking";
    }
    if (field.askWhen === "service_inquiry") {
      return purpose === "service" || purpose === "booking";
    }
    if (field.askWhen === "new_callers") {
      return purpose !== "general";
    }
    return false;
  }

  if (purpose === "message" && field.askWhen === "when_booking") {
    return false;
  }

  return true;
}

/**
 * Which manifest fields the runtime should collect now — driven by published field manifest.
 */
export function receptionistFieldsForCollection(
  manifest: AgentFieldDefinition[],
  purpose: ReceptionistCollectionPurpose = "general",
): AgentFieldDefinition[] {
  return manifest.filter((field) => fieldAppliesToPurpose(field, purpose));
}

export function sortReceptionistFieldsForCollection(
  manifest: AgentFieldDefinition[],
  fields: AgentFieldDefinition[],
): AgentFieldDefinition[] {
  return sortFieldsByManifestOrder(manifest, fields);
}

export function missingReceptionistFields(
  manifest: AgentFieldDefinition[],
  fields: Record<string, string> | undefined,
  purpose?: ReceptionistCollectionPurpose,
): AgentFieldDefinition[] {
  const scoped = receptionistFieldsForCollection(manifest, purpose);
  const missing = scoped.filter((f) => !fields?.[f.id]?.trim());
  return sortReceptionistFieldsForCollection(manifest, missing);
}
