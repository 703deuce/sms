import type { AmyRealtimeSession } from "../src/lib/voice/realtime-session/types";
import { preprodCallerAni } from "./preprod-harness";

/** Produce a valid sample value for a manifest field during LiveKit preprod tests. */
export function sampleValueForManifestField(
  session: AmyRealtimeSession,
  fieldId: string | null | undefined,
  index = 0,
): string {
  if (!fieldId) return `sample-${index}`;
  const field = session.fieldManifest.find((entry) => entry.field_id === fieldId);
  if (!field) return `sample-${fieldId}-${index}`;

  switch (field.type) {
    case "email":
      return "jordan@example.com";
    case "phone":
      return preprodCallerAni();
    case "long_text":
      return "Garage needs cleaning";
    case "number":
      return "42";
    case "boolean":
      return "yes";
    default:
      if (field.field_id.includes("name")) return "Jordan Lee";
      if (field.field_id.includes("notes") || field.field_id.includes("problem")) {
        return "Garage needs cleaning";
      }
      return `sample-${field.field_id}-${index}`;
  }
}
