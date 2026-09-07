import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import { SYSTEM_FIELD_IDS } from "@/lib/voice/field-runtime/system-fields";
import { looksLikeSpokenEmail } from "@/lib/voice/domain-actions/late-booking-fields";
import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";

const ADDRESS_UTTERANCE_PATTERN =
  /\b(address|street|lane|road|avenue|ave|blvd|boulevard|drive|dr|court|ct|way|place|pl|zip|virginia|va\b|fredericksburg|stafford)/i;

function looksLikePersonName(utterance: string): boolean {
  const trimmed = utterance.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (/[@\d]/.test(trimmed)) return false;
  if (looksLikeSpokenEmail(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;
  return words.every((word) => /^[A-Za-z][A-Za-z'.-]*$/.test(word));
}

function missingAddressFieldId(session: AmyRealtimeSession): string | null {
  const manifestIds = manifestFieldIds(session.fieldManifest);
  const addressId = resolveAddressFieldId(manifestIds);
  if (!addressId) return null;
  if (!session.collectedFields[addressId]?.trim()) return addressId;
  return null;
}

function looksLikeAddressUtterance(utterance: string): boolean {
  const trimmed = utterance.trim();
  if (!trimmed) return false;
  if (/^\d{1,6}\s+\w/.test(trimmed)) return true;
  return ADDRESS_UTTERANCE_PATTERN.test(trimmed);
}

const EXTRACTED_KEY_ALIASES: Record<string, string[]> = {
  [SYSTEM_FIELD_IDS.name]: ["name", "caller_name", "full_name", "customer_name"],
  [SYSTEM_FIELD_IDS.email]: ["email", "email_address"],
  [SYSTEM_FIELD_IDS.phone]: ["phone", "phone_number", "callback_number"],
  [SYSTEM_FIELD_IDS.address]: [
    "address",
    "addr",
    "service_address",
    "serviceAddress",
    "fld_service_address",
  ],
  [SYSTEM_FIELD_IDS.service]: ["service", "service_name", "serviceName", "problem", "issue"],
  fld_problem: ["problem", "issue", "service_issue", "description", "problem_description"],
  fld_notes: ["notes", "details", "additional_details"],
};

function manifestFieldIds(manifest: RuntimeFieldManifestEntry[]): Set<string> {
  return new Set(manifest.map((f) => f.field_id));
}

const ADDRESS_FIELD_CANDIDATES = [
  SYSTEM_FIELD_IDS.address,
  "fld_service_address",
] as const;

function resolveAddressFieldId(manifestIds: Set<string>): string | null {
  for (const fieldId of ADDRESS_FIELD_CANDIDATES) {
    if (manifestIds.has(fieldId)) return fieldId;
  }
  return null;
}

function resolveFieldId(key: string, manifestIds: Set<string>): string | null {
  const trimmed = key.trim();
  if (manifestIds.has(trimmed)) return trimmed;

  for (const [fieldId, aliases] of Object.entries(EXTRACTED_KEY_ALIASES)) {
    if (aliases.includes(trimmed)) {
      if (manifestIds.has(fieldId)) return fieldId;
      if (fieldId === SYSTEM_FIELD_IDS.address) {
        const addressId = resolveAddressFieldId(manifestIds);
        if (addressId) return addressId;
      }
    }
  }

  if (trimmed.startsWith("fld_") || trimmed.startsWith("sys_")) {
    return manifestIds.has(trimmed) ? trimmed : null;
  }

  const custom = `fld_${trimmed.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  return manifestIds.has(custom) ? custom : null;
}

/**
 * Normalize LLM-extracted key/value pairs to workflow field ids.
 * Unknown keys are dropped; empty values are skipped.
 */
export function normalizeExtractedFields(input: {
  session: AmyRealtimeSession;
  extracted: Record<string, string>;
}): Record<string, string> {
  const manifestIds = manifestFieldIds(input.session.fieldManifest);
  const out: Record<string, string> = {};

  for (const [key, raw] of Object.entries(input.extracted)) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const fieldId = resolveFieldId(key, manifestIds);
    if (fieldId) out[fieldId] = value;
  }

  return out;
}

/**
 * Infer field values from a single utterance when the model did not structure them.
 * Used as a fallback for active/missing fields only.
 */
export function inferFieldsFromUtterance(input: {
  session: AmyRealtimeSession;
  utterance: string;
}): Record<string, string> {
  const utterance = input.utterance.trim();
  if (!utterance) return {};

  const missing = input.session.fieldManifest.filter(
    (f) => f.required && !input.session.collectedFields[f.field_id]?.trim(),
  );
  if (!missing.length) return {};

  const out: Record<string, string> = {};
  const missingIds = new Set(missing.map((field) => field.field_id));
  const activeId = input.session.activeField || missing[0]?.field_id;

  if (missingIds.has(SYSTEM_FIELD_IDS.email) && looksLikeSpokenEmail(utterance)) {
    out[SYSTEM_FIELD_IDS.email] = utterance;
    return out;
  }

  // When the runtime is actively collecting a field, bind free-form replies to it
  // instead of misclassifying them as names/addresses.
  if (activeId && missingIds.has(activeId)) {
    out[activeId] = utterance;
    return out;
  }

  if (missingIds.has(SYSTEM_FIELD_IDS.name) && looksLikePersonName(utterance)) {
    out[SYSTEM_FIELD_IDS.name] = utterance;
    return out;
  }

  const missingAddressId = missingAddressFieldId(input.session);
  if (missingAddressId && looksLikeAddressUtterance(utterance)) {
    out[missingAddressId] = utterance;
    return out;
  }

  if (activeId) {
    out[activeId] = utterance;
  }

  return out;
}

export function mergeExtractedFieldMaps(
  ...maps: Array<Record<string, string>>
): Record<string, string> {
  return Object.assign({}, ...maps);
}
