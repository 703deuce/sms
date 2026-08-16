import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { captureUsPhoneDigits } from "@/lib/voice/receptionist/field-validation";

export type CollectionUtteranceKind =
  | "field_value"
  | "availability_request"
  | "clarification"
  | "phone_partial";

const META_QUESTION_RE =
  /\b(can't|cannot|won't|why|what|how|hello|hey|wait|confirm|appointment|booked|booking|explain|hear me|are you there)\b/i;

const AVAILABILITY_REQUEST_RE =
  /\b(check|see|look at|find|show)\b.*\b(availability|available|opening|openings|slot|slots|time|times|schedule|calendar)\b/i;

export function looksLikeAvailabilityRequest(transcript: string): boolean {
  const t = transcript.trim();
  if (!t) return false;
  if (AVAILABILITY_REQUEST_RE.test(t)) return true;
  if (/\bwhat times?\b/i.test(t) && /\bavailable\b/i.test(t)) return true;
  if (/^can you (check|book|schedule)/i.test(t)) return true;
  return false;
}

export function looksLikeMetaQuestion(transcript: string): boolean {
  const t = transcript.trim();
  if (!t) return true;
  if (/\?$/.test(t) && META_QUESTION_RE.test(t)) return true;
  if (/^(hello|hi|hey)\b/i.test(t)) return true;
  if (/^(oh|um|so)\b/i.test(t) && META_QUESTION_RE.test(t)) return true;
  if (/\b(can't|cannot)\b/i.test(t) && /\b(confirm|book|appointment)\b/i.test(t)) return true;
  return false;
}

function isPlausibleEmailUtterance(raw: string): boolean {
  const t = raw.trim();
  if (looksLikeMetaQuestion(t)) return false;
  const normalized = t
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s+/g, "")
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || /\b(at|dot)\b/i.test(t);
}

function isPlausibleNameUtterance(raw: string): boolean {
  const t = raw.trim();
  if (looksLikeMetaQuestion(t)) return false;
  if (t.length < 2 || !/[a-zA-Z]/.test(t)) return false;
  if (/^(yes|no|yeah|nope|ok|okay|sure|correct|right)\.?$/i.test(t)) return false;
  return true;
}

function isPlausibleAddressUtterance(raw: string): boolean {
  const t = raw.trim();
  if (looksLikeMetaQuestion(t)) return false;
  if (/\d/.test(t)) return true;
  if (/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|way|blvd|boulevard)\b/i.test(t)) {
    return true;
  }
  return t.split(/\s+/).length >= 3;
}

export function classifyCollectionUtterance(
  transcript: string,
  activeField: AgentFieldDefinition | undefined,
  priorPhoneDigits = "",
): CollectionUtteranceKind {
  const t = transcript.trim();
  if (!t) return "clarification";

  if (looksLikeAvailabilityRequest(t)) return "availability_request";
  if (looksLikeMetaQuestion(t)) return "clarification";

  if (!activeField) return "clarification";

  if (activeField.type === "phone" || activeField.id === "phone") {
    const capture = captureUsPhoneDigits(t, priorPhoneDigits);
    if (capture.status === "incomplete") {
      return capture.digits.length > 0 ? "phone_partial" : "clarification";
    }
    return "field_value";
  }

  if (activeField.type === "email" || activeField.id === "email") {
    return isPlausibleEmailUtterance(t) ? "field_value" : "clarification";
  }

  if (activeField.id === "name") {
    return isPlausibleNameUtterance(t) ? "field_value" : "clarification";
  }

  if (activeField.id === "address") {
    return isPlausibleAddressUtterance(t) ? "field_value" : "clarification";
  }

  if (activeField.id === "reason" && looksLikeMetaQuestion(t)) return "clarification";
  return "field_value";
}
