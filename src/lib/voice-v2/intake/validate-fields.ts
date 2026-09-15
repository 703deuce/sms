import "server-only";

import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { INTAKE_FIELD_KEYS, type IntakeFieldKey, type VoiceV2IntakeSchema } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldValidationResult =
  | {
      ok: true;
      normalized: Partial<Record<IntakeFieldKey, string>>;
      disabledFields: IntakeFieldKey[];
    }
  | { ok: false; invalidFields: IntakeFieldKey[]; disabledFields: IntakeFieldKey[] };

export function validateIntakeFieldPayload(
  schema: VoiceV2IntakeSchema,
  rawFields: Record<string, unknown>,
): FieldValidationResult {
  const enabled = new Set(schema.fields.map((f) => f.key));
  const normalized: Partial<Record<IntakeFieldKey, string>> = {};
  const invalidFields: IntakeFieldKey[] = [];
  const disabledFields: IntakeFieldKey[] = [];

  for (const [key, value] of Object.entries(rawFields)) {
    const k = key as IntakeFieldKey;
    if (!INTAKE_FIELD_KEYS.includes(k)) continue;
    if (!enabled.has(k)) {
      if (String(value ?? "").trim()) disabledFields.push(k);
      continue;
    }
    const str = String(value ?? "").trim();
    if (!str) {
      invalidFields.push(k);
      continue;
    }
    switch (k) {
      case "name":
      case "address":
      case "service_reason":
        normalized[k] = str;
        break;
      case "email":
        if (!EMAIL_RE.test(str)) invalidFields.push(k);
        else normalized[k] = str;
        break;
      case "phone":
        try {
          normalized[k] = normalizeE164(str);
        } catch {
          invalidFields.push(k);
        }
        break;
      default:
        invalidFields.push(k);
    }
  }

  if (invalidFields.length) {
    return { ok: false, invalidFields, disabledFields };
  }
  if (Object.keys(normalized).length === 0 && disabledFields.length > 0) {
    return { ok: false, invalidFields, disabledFields };
  }
  return { ok: true, normalized, disabledFields };
}
