import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import { FieldValidationError, normalizeSpokenEmail, validateFieldValue } from "@/lib/voice/field-runtime/validate";
import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import { normalizeExtractedFields } from "./field-extraction";

function extractEmailCandidate(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || trimmed;
}

export type PreparedFieldPersist = {
  fields: Record<string, string>;
  errors: Array<{ fieldId: string; message: string }>;
};

function manifestEntry(
  session: AmyRealtimeSession,
  fieldId: string,
): RuntimeFieldManifestEntry {
  return (
    session.fieldManifest.find((f) => f.field_id === fieldId) || {
      field_id: fieldId,
      label: fieldId,
      type: "text" as const,
      required: true,
      collection_instruction: `Ask for ${fieldId}.`,
    }
  );
}

/**
 * Single canonical write path: map aliases → normalize → validate → ready for persist.
 */
export function prepareFieldsForPersistence(input: {
  session: AmyRealtimeSession;
  extracted?: Record<string, string>;
  utterance?: string;
  activeFieldId?: string | null;
}): PreparedFieldPersist {
  const mapped = normalizeExtractedFields({
    session: input.session,
    extracted: input.extracted || {},
  });

  if (input.utterance?.trim() && input.activeFieldId) {
    const active = input.activeFieldId.trim();
    if (!mapped[active]) mapped[active] = input.utterance.trim();
  }

  const fields: Record<string, string> = {};
  const errors: PreparedFieldPersist["errors"] = [];

  for (const [fieldId, raw] of Object.entries(mapped)) {
    const entry = manifestEntry(input.session, fieldId);
    const def = {
      field_id: entry.field_id,
      label: entry.label,
      type: entry.type,
      required: entry.required,
      collection_instruction: entry.collection_instruction,
      kind: "custom" as const,
    };

    try {
      const valueForValidation =
        entry.type === "email"
          ? normalizeSpokenEmail(String(raw))
          : raw;
      const validated = validateFieldValue(def, valueForValidation);
      fields[fieldId] = String(validated).trim();
    } catch (err) {
      const message =
        err instanceof FieldValidationError
          ? err.message
          : `${entry.label} did not look valid.`;
      errors.push({ fieldId, message });
    }
  }

  return { fields, errors };
}

export function normalizeSpokenFieldValue(
  fieldType: RuntimeFieldManifestEntry["type"],
  raw: string,
): string {
  const trimmed = raw.trim();
  if (fieldType === "email") return normalizeSpokenEmail(trimmed);
  return trimmed;
}
