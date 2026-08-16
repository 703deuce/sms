import { validateReceptionistFieldValue } from "@/lib/voice/receptionist/field-validation";
import { extractDeterministicFieldsFromUtterance } from "../../../../voice-runtime/src/frontdesk/receptionist/collection-field-extractor";
import type { ExtractFieldsInput, PythonRuntimeError } from "./types";

/** Lightweight field extraction — no handlers.ts / booking-provider chain. */
export async function extractFieldsForPython(
  input: ExtractFieldsInput,
): Promise<{ ok: true; fields: Record<string, string>; correction: boolean } | PythonRuntimeError> {
  const result = extractDeterministicFieldsFromUtterance(
    input.transcript,
    input.manifest,
    input.currentFields,
    input.callerE164,
  );
  const validated: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(result.fields)) {
    const field = input.manifest.find((f) => f.id === fieldId);
    if (!field) continue;
    try {
      validated[fieldId] = validateReceptionistFieldValue(field, value);
    } catch {
      continue;
    }
  }
  return { ok: true, fields: validated, correction: result.correction };
}
