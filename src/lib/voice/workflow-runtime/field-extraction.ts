import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import { SYSTEM_FIELD_IDS } from "@/lib/voice/field-runtime/system-fields";
import { looksLikeSpokenEmail } from "@/lib/voice/domain-actions/late-booking-fields";
import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";

const EXTRACTED_KEY_ALIASES: Record<string, string[]> = {
  [SYSTEM_FIELD_IDS.name]: ["name", "caller_name", "full_name", "customer_name"],
  [SYSTEM_FIELD_IDS.email]: ["email", "email_address"],
  [SYSTEM_FIELD_IDS.phone]: ["phone", "phone_number", "callback_number"],
  [SYSTEM_FIELD_IDS.address]: [
    "address",
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

function resolveFieldId(key: string, manifestIds: Set<string>): string | null {
  const trimmed = key.trim();
  if (manifestIds.has(trimmed)) return trimmed;

  for (const [fieldId, aliases] of Object.entries(EXTRACTED_KEY_ALIASES)) {
    if (aliases.includes(trimmed) && manifestIds.has(fieldId)) return fieldId;
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
  const activeId = input.session.activeField || missing[0]?.field_id;

  if (activeId && looksLikeSpokenEmail(utterance)) {
    out[SYSTEM_FIELD_IDS.email] = utterance;
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
