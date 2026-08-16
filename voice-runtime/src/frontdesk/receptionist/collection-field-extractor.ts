import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
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

const CORRECTION_RE =
  /\b(actually|instead|correction|not that|wait no|i meant|i said|use my|change my)\b/i;

const BUSINESS_QUESTION_RE =
  /\b(how much|what do you charge|cost of|price of|service call cost|diagnostic fee)\b/i;

const CALLER_ID_PHONE_RE =
  /\b(calling from|number i'?m calling from|number i am calling from|use (my |the )?number|this number|same number|number i'?m on)\b/i;

export type FieldExtractionResult = {
  fields: Record<string, string>;
  correction: boolean;
  skippedReason?: string;
  extractionSource?: "deterministic" | "semantic_llm";
};

/** Fast deterministic extraction — phone digits, email, obvious patterns. No LLM. */
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

  const correction = CORRECTION_RE.test(trimmed);
  const baseFields = { ...currentFields };

  if (correction) {
    if (/\b(phone|number|cell|callback)\b/i.test(trimmed)) delete baseFields.phone;
    if (/\b(address|street|live at|located)\b/i.test(trimmed)) delete baseFields.address;
    if (/\b(name)\b/i.test(trimmed)) delete baseFields.name;
    if (/\b(email)\b/i.test(trimmed)) delete baseFields.email;
    if (/\b(reason|issue|problem|ac|hvac)\b/i.test(trimmed)) delete baseFields.reason;
  }

  if (
    !correction &&
    looksLikeFreeformCallerStatement(trimmed) &&
    BUSINESS_QUESTION_RE.test(trimmed)
  ) {
    return { fields: {}, correction: false, skippedReason: "business_question" };
  }

  const fields = heuristicReceptionistFieldBackfill([trimmed], manifest, baseFields);

  if (fields.address && (fields.address.length > 72 || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(fields.address))) {
    delete fields.address;
  }

  const nameField = manifest.find((f) => f.id === "name");
  if (!fields.name && !baseFields.name?.trim() && nameField) {
    const nameMatch = trimmed.match(
      /\b(?:i'?m|i am|my name is|this is)\s+([A-Za-z][A-Za-z' -]{1,40}?)(?=\s*,|\s+my\s+(?:number|phone|cell)|\s+and\s+)/i,
    );
    if (nameMatch?.[1]) {
      try {
        fields.name = validateReceptionistFieldValue(nameField, nameMatch[1].trim());
      } catch {
        // skip invalid name fragment
      }
    }
  }

  const addressField = manifest.find((f) => f.id === "address");
  if (!fields.address && !baseFields.address?.trim() && addressField) {
    const addressMatch = trimmed.match(
      /\b(?:i'?m at|i am at|i live at|we'?re at|at|over on)\s+([^,]+(?:,\s*[A-Za-z .]+)?)(?=\s*,\s*and|\s+and\s+)/i,
    );
    if (addressMatch?.[1]) {
      try {
        fields.address = validateReceptionistFieldValue(addressField, addressMatch[1].trim());
      } catch {
        // skip invalid address fragment
      }
    }
  }

  if (!fields.reason && !baseFields.reason?.trim()) {
    const reasonField = manifest.find((f) => f.id === "reason");
    const tail = trimmed.match(/\band\s+my\s+(.+?)[.!?]?\s*$/i);
    if (reasonField && tail?.[1] && looksLikeFreeformCallerStatement(tail[1])) {
      try {
        fields.reason = validateReceptionistFieldValue(reasonField, tail[1].trim());
      } catch {
        // leave reason missing — runtime will ask
      }
    }
  }

  if (
    !fields.phone &&
    !baseFields.phone?.trim() &&
    CALLER_ID_PHONE_RE.test(trimmed) &&
    callerE164
  ) {
    const normalized = tryNormalizeE164(callerE164) || callerE164;
    fields.phone = normalized;
  }

  return { fields, correction, extractionSource: "deterministic" };
}

/** Stable save order when multiple fields arrive in one utterance. */
export const COLLECTION_FIELD_SAVE_ORDER = [
  "reason",
  "name",
  "phone",
  "address",
  "email",
] as const;
