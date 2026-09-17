import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { IntakeFieldKey, IntakeFieldValueType, VoiceV2IntakeSchema } from "./types";
import { normalizeVoiceIntakeEmail } from "./normalize-email";
import { isBookingIntentOnlyServiceReason } from "./booking-intent-guard";

/** Live-call intake: presence capture, not web-form format validation. */
export type IntakeFieldCapture = {
  raw: string;
  normalizedValue?: string;
};

export type FieldValidationResult =
  | {
      ok: true;
      normalized: Partial<Record<IntakeFieldKey, string>>;
      captures: Partial<Record<IntakeFieldKey, IntakeFieldCapture>>;
      disabledFields: IntakeFieldKey[];
      invalidFields: IntakeFieldKey[];
    }
  | {
      ok: false;
      normalized: Partial<Record<IntakeFieldKey, string>>;
      captures: Partial<Record<IntakeFieldKey, IntakeFieldCapture>>;
      invalidFields: IntakeFieldKey[];
      disabledFields: IntakeFieldKey[];
    };

function schemaFieldMap(schema: VoiceV2IntakeSchema): Map<string, IntakeFieldValueType> {
  return new Map(schema.fields.map((f) => [f.key, f.valueType]));
}

function resolveSchemaFieldKey(
  enabled: Map<string, IntakeFieldValueType>,
  rawKey: string,
): string {
  const k = rawKey.trim();
  if (!k) return k;
  if (enabled.has(k)) return k;
  const lower = k.toLowerCase();
  if (enabled.has(lower)) return lower;
  return (INTAKE_FIELD_ALIASES[lower] || k) as string;
}

const INTAKE_FIELD_ALIASES: Record<string, IntakeFieldKey> = {
  email: "email",
  name: "name",
  phone: "phone",
  address: "address",
  service_reason: "service_reason",
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

export function coerceIntakeFieldString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "value" in (value as object)) {
    return String((value as { value?: unknown }).value ?? "").trim();
  }
  return String(value).trim();
}

/** Map common LLM / CRM keys onto wizard intake keys before validation. */
export function normalizeIntakeFieldKeys(
  rawFields: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawFields)) {
    const k = key.trim();
    if (!k) continue;
    const mapped = (INTAKE_FIELD_ALIASES[k.toLowerCase()] || k.toLowerCase()) as IntakeFieldKey;
    if (out[mapped] === undefined || coerceIntakeFieldString(out[mapped]) === "") {
      out[mapped] = value;
    }
  }
  return out;
}

/** Best-effort companion value — never rejects raw capture. */
export function bestEffortNormalizeIntakeValue(
  valueType: IntakeFieldValueType,
  key: string,
  raw: string,
): string | undefined {
  switch (valueType) {
    case "email": {
      const n = normalizeVoiceIntakeEmail(raw);
      if (!n || n === raw) return undefined;
      return n;
    }
    case "phone":
      try {
        const e164 = normalizeE164(raw);
        return e164 !== raw ? e164 : undefined;
      } catch {
        return undefined;
      }
    default:
      return undefined;
  }
}

function shouldSkipServiceReasonValue(key: string, raw: string): boolean {
  return key === "service_reason" && isBookingIntentOnlyServiceReason(raw);
}

/**
 * Voice V2 live intake — conversation capture, not web-form validation.
 * Caller speech is evidence: non-empty → KNOWN. Optional normalizedValue is annotation only.
 * invalidFields = enabled keys explicitly sent empty (no usable answer in payload).
 * Booking-intent-only service_reason is not a field value (caller-first law).
 * Format regex never rejects; post-call reconciliation owns cleanup.
 */
export function captureIntakeFieldPayload(
  schema: VoiceV2IntakeSchema,
  rawFields: Record<string, unknown>,
): FieldValidationResult {
  const fields = normalizeIntakeFieldKeys(rawFields);
  const enabled = schemaFieldMap(schema);
  const captures: Partial<Record<IntakeFieldKey, IntakeFieldCapture>> = {};
  const normalized: Partial<Record<IntakeFieldKey, string>> = {};
  const invalidFields: IntakeFieldKey[] = [];
  const disabledFields: IntakeFieldKey[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const k = resolveSchemaFieldKey(enabled, key) as IntakeFieldKey;
    if (!k) continue;
    const str = coerceIntakeFieldString(value);
    const valueType = enabled.get(k);

    if (!valueType) {
      if (str) disabledFields.push(k);
      continue;
    }

    if (!str) {
      invalidFields.push(k);
      continue;
    }

    if (shouldSkipServiceReasonValue(k, str)) {
      invalidFields.push(k);
      continue;
    }

    const companion = bestEffortNormalizeIntakeValue(valueType, k, str);
    captures[k] = { raw: str, normalizedValue: companion };
    normalized[k] = str;
  }

  const capturedCount = Object.keys(captures).length;
  if (capturedCount > 0) {
    return {
      ok: true,
      normalized,
      captures,
      disabledFields,
      invalidFields: invalidFields.length ? invalidFields : [],
    };
  }

  if (invalidFields.length > 0 || disabledFields.length > 0) {
    return { ok: false, normalized, captures, invalidFields, disabledFields };
  }

  return {
    ok: false,
    normalized,
    captures,
    invalidFields: [],
    disabledFields: [],
  };
}

/** @deprecated name — use captureIntakeFieldPayload */
export function validateIntakeFieldPayload(
  schema: VoiceV2IntakeSchema,
  rawFields: Record<string, unknown>,
): FieldValidationResult {
  return captureIntakeFieldPayload(schema, rawFields);
}
