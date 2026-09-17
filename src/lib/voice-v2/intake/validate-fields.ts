import "server-only";

import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { IntakeFieldKey, IntakeFieldValueType, VoiceV2IntakeSchema } from "./types";
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

function schemaFieldMap(schema: VoiceV2IntakeSchema): Map<string, IntakeFieldValueType> {
  return new Map(schema.fields.map((f) => [f.key, f.valueType]));
}

const INTAKE_FIELD_ALIASES: Record<string, IntakeFieldKey> = {
  sys_email: "email",
  customer_email: "email",
  caller_email: "email",
  sys_name: "name",
  full_name: "name",
  customer_name: "name",
  caller_name: "name",
  sys_phone: "phone",
  customer_phone: "phone",
  callback_number: "phone",
};

/** Map common LLM / CRM keys onto wizard intake keys before validation. */
export function normalizeIntakeFieldKeys(
  rawFields: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawFields)) {
    const k = key.trim();
    if (!k) continue;
    const mapped = (INTAKE_FIELD_ALIASES[k] || k) as IntakeFieldKey;
    if (out[mapped] === undefined || String(out[mapped] ?? "").trim() === "") {
      out[mapped] = value;
    }
  }
  return out;
}

function normalizeByType(
  valueType: IntakeFieldValueType,
  key: string,
  str: string,
): string | null {
  switch (valueType) {
    case "text":
      if (key === "service_reason" && isBookingIntentOnlyServiceReason(str)) return null;
      return str;
    case "address":
      return str;
    case "email": {
      const email =
        normalizeVoiceIntakeEmail(str) ?? (str.includes("@") ? str.trim().toLowerCase() : null);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      return email;
    }
    case "phone":
      try {
        return normalizeE164(str);
      } catch {
        return null;
      }
    default:
      return str;
  }
}

export function validateIntakeFieldPayload(
  schema: VoiceV2IntakeSchema,
  rawFields: Record<string, unknown>,
): FieldValidationResult {
  const fields = normalizeIntakeFieldKeys(rawFields);
  const enabled = schemaFieldMap(schema);
  const normalized: Partial<Record<IntakeFieldKey, string>> = {};
  const invalidFields: IntakeFieldKey[] = [];
  const disabledFields: IntakeFieldKey[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const k = key.trim();
    if (!k) continue;
    const str = String(value ?? "").trim();
    if (!str) {
      if (enabled.has(k)) invalidFields.push(k as IntakeFieldKey);
      continue;
    }
    const valueType = enabled.get(k);
    if (!valueType) {
      disabledFields.push(k);
      continue;
    }
    const norm = normalizeByType(valueType, k, str);
    if (!norm) {
      invalidFields.push(k);
      continue;
    }
    normalized[k] = norm;
  }

  if (invalidFields.length) {
    return { ok: false, normalized, invalidFields, disabledFields };
  }
  if (Object.keys(normalized).length === 0 && disabledFields.length > 0) {
    return { ok: false, normalized, invalidFields, disabledFields };
  }
  return { ok: true, normalized, disabledFields, invalidFields: [] };
}
