import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { captureUsPhoneDigits } from "@/lib/voice/receptionist/field-validation";
import {
  isAddressField,
  isEmailField,
  isPhoneField,
  looksLikeNameField,
} from "@/lib/voice/receptionist/field-manifest-runtime";
import {
  asksToSpellField,
  isFragmentAccumulationField,
  isSpellingFragment,
  looksLikeAddressFragment,
  looksLikeEmailFragment,
  mergeFragmentUtterance,
} from "./collection-fragment-buffer";

export type CollectionUtteranceKind =
  | "field_value"
  | "availability_request"
  | "clarification"
  | "phone_partial"
  | "fragment_partial";

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
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
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return true;
  if (/\d/.test(t) && /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|way|blvd|boulevard)\b/i.test(t)) {
    return true;
  }
  return false;
}

export function classifyCollectionUtterance(
  transcript: string,
  activeField: AgentFieldDefinition | undefined,
  priorFragmentBuffer = "",
): CollectionUtteranceKind {
  const t = transcript.trim();
  if (!t) return "clarification";

  if (looksLikeAvailabilityRequest(t)) return "availability_request";
  if (looksLikeMetaQuestion(t)) return "clarification";

  if (!activeField) return "clarification";

  if (isPhoneField(activeField)) {
    const capture = captureUsPhoneDigits(t, priorFragmentBuffer);
    if (capture.status === "incomplete") {
      return capture.digits.length > 0 ? "phone_partial" : "clarification";
    }
    return "field_value";
  }

  if (isFragmentAccumulationField(activeField)) {
    const merged = mergeFragmentUtterance(activeField, priorFragmentBuffer, t);

    if (isEmailField(activeField)) {
      if (isPlausibleEmailUtterance(merged)) return "field_value";
      if (looksLikeEmailFragment(t) || priorFragmentBuffer) return "fragment_partial";
      return "clarification";
    }

    if (isAddressField(activeField)) {
      if (isPlausibleAddressUtterance(merged) && !priorFragmentBuffer) return "field_value";
      if (priorFragmentBuffer && isPlausibleAddressUtterance(merged)) {
        return merged.split(/\s+/).length >= 4 ? "field_value" : "fragment_partial";
      }
      if (looksLikeAddressFragment(t, priorFragmentBuffer) || priorFragmentBuffer) {
        return "fragment_partial";
      }
      return "clarification";
    }

    if (looksLikeNameField(activeField) || asksToSpellField(activeField)) {
      if (asksToSpellField(activeField)) {
        if (isSpellingFragment(t) || (priorFragmentBuffer && isSpellingFragment(merged))) {
          return "fragment_partial";
        }
        if (isPlausibleNameUtterance(merged) && merged.replace(/\s+/g, "").length >= 3) {
          return "field_value";
        }
        return priorFragmentBuffer ? "fragment_partial" : "clarification";
      }
      if (isPlausibleNameUtterance(merged) && merged.replace(/\s+/g, "").length >= 3) {
        return "field_value";
      }
      if (isSpellingFragment(t) || priorFragmentBuffer) {
        return "fragment_partial";
      }
      if (isPlausibleNameUtterance(t)) return "field_value";
      return "clarification";
    }
  }

  if (isEmailField(activeField)) {
    return isPlausibleEmailUtterance(t) ? "field_value" : "clarification";
  }

  if (isAddressField(activeField)) {
    return isPlausibleAddressUtterance(t) ? "field_value" : "clarification";
  }

  if (looksLikeNameField(activeField)) {
    return isPlausibleNameUtterance(t) ? "field_value" : "clarification";
  }

  if (looksLikeMetaQuestion(t)) return "clarification";
  return "field_value";
}
