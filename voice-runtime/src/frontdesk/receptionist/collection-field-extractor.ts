import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import {
  fieldsToClearOnCorrection,
  utteranceReferencesCallerIdPhone,
} from "@/lib/voice/receptionist/field-manifest-runtime";
import {
  heuristicReceptionistFieldBackfill,
  looksLikeFreeformCallerStatement,
} from "@/lib/voice/receptionist/field-backfill";
import { validateReceptionistFieldValue } from "@/lib/voice/receptionist/field-validation";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  looksLikeAvailabilityRequest,
  looksLikeMetaQuestion,
} from "./collection-utterance-validation";

const BUSINESS_QUESTION_RE =
  /\b(how much|what do you charge|cost of|price of|service call cost|diagnostic fee)\b/i;

export type FieldExtractionResult = {
  fields: Record<string, string>;
  correction: boolean;
  skippedReason?: string;
  extractionSource?: "deterministic" | "semantic_llm";
};

/** Fast deterministic extraction — uses manifest field types, not industry-specific ids. */
export function extractDeterministicFieldsFromUtterance(
  transcript: string,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
  callerE164?: string,
): FieldExtractionResult {
  const trimmed = transcript.trim();
  if (!trimmed) return { fields: {}, correction: false, skippedReason: "empty" };

  if (looksLikeAvailabilityRequest(trimmed)) {
    return { fields: {}, correction: false, skippedReason: "availability_request" };
  }
  if (looksLikeMetaQuestion(trimmed)) {
    return { fields: {}, correction: false, skippedReason: "meta_question" };
  }
  if (BUSINESS_QUESTION_RE.test(trimmed) && trimmed.includes("?")) {
    return { fields: {}, correction: false, skippedReason: "business_question" };
  }

  const correctionFields = fieldsToClearOnCorrection(trimmed, manifest);
  const correction = correctionFields.length > 0;
  const baseFields = { ...currentFields };
  for (const fieldId of correctionFields) {
    delete baseFields[fieldId];
  }

  if (
    !correction &&
    looksLikeFreeformCallerStatement(trimmed) &&
    BUSINESS_QUESTION_RE.test(trimmed)
  ) {
    return { fields: {}, correction: false, skippedReason: "business_question" };
  }

  const fields = heuristicReceptionistFieldBackfill([trimmed], manifest, baseFields);

  const phoneField = manifest.find((f) => f.type === "phone");
  if (
    phoneField &&
    !fields[phoneField.id]?.trim() &&
    !baseFields[phoneField.id]?.trim() &&
    utteranceReferencesCallerIdPhone(trimmed) &&
    callerE164
  ) {
    fields[phoneField.id] = tryNormalizeE164(callerE164) || callerE164;
  }

  return { fields, correction, extractionSource: "deterministic" };
}
