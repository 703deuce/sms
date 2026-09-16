import "server-only";

import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { INTAKE_FIELD_KEYS, type IntakeFieldKey, type VoiceV2IntakeSchema } from "./types";
import { normalizeVoiceIntakeEmail } from "./normalize-email";
import { isBookingIntentOnlyServiceReason } from "./booking-intent-guard";

export type FieldValidationResult =
  | {
      ok: true;
      normalized: Partial<Record<IntakeFieldKey, string>>;
      disabledFields: IntakeFieldKey[];
      invalidFields: IntakeFieldKey[];
    }
  | {
      ok: false;
      normalized: Partial<Record<IntakeFieldKey, string>>;
      invalidFields: IntakeFieldKey[];
      disabledFields: IntakeFieldKey[];
    };

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
        normalized[k] = str;
        break;
      case "service_reason":
        if (isBookingIntentOnlyServiceReason(str)) {
          invalidFields.push(k);
        } else {
          normalized[k] = str;
        }
        break;
      case "email": {
        const email = normalizeVoiceIntakeEmail(str) ?? (str.includes("@") ? str.trim().toLowerCase() : null);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalidFields.push(k);
        else normalized[k] = email;
        break;
      }
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
    return { ok: false, normalized, invalidFields, disabledFields };
  }
  if (Object.keys(normalized).length === 0 && disabledFields.length > 0) {
    return { ok: false, normalized, invalidFields, disabledFields };
  }
  return { ok: true, normalized, disabledFields, invalidFields: [] };
}
