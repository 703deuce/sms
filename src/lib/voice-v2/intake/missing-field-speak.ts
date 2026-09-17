import type { IntakeFieldKey, VoiceV2IntakeSchema } from "./types";

/** Deterministic copy for BOOK gate / save tool — uses wizard labels, not raw keys. */
export function speakForMissingBeforeBookingFields(
  schema: VoiceV2IntakeSchema,
  missing: IntakeFieldKey[],
): string {
  if (missing.length === 0) {
    return "I still need a bit more information before I can book that time.";
  }
  const labels = missing.map((key) => {
    const row = schema.fields.find((f) => f.key === key);
    return row?.label?.trim() || key;
  });
  if (labels.length === 1) {
    return `I still need your ${labels[0]} before I can book that time.`;
  }
  if (labels.length === 2) {
    return `I still need your ${labels[0]} and ${labels[1]} before I can book that time.`;
  }
  const last = labels.pop();
  return `I still need your ${labels.join(", ")}, and ${last} before I can book that time.`;
}
