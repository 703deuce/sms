import type { AgentFieldDefinition } from "./types";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";

const PLACEHOLDER_PATTERNS = [
  /\(no\b/i,
  /\bnot provided\b/i,
  /\bunknown\b/i,
  /\bn\/a\b/i,
  /^none$/i,
  /\btranscription\b/i,
  /\bplaceholder\b/i,
];

export function isReceptionistFieldPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function extractPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export type PhoneCaptureResult =
  | { status: "complete"; normalized: string; digits: string }
  | { status: "incomplete"; digits: string; message: string };

/** Merge prior partial digits with a new utterance; US numbers need 10 digits before accept. */
export function captureUsPhoneDigits(raw: string, priorDigits = ""): PhoneCaptureResult {
  const trimmed = raw.trim();
  if (isReceptionistFieldPlaceholder(trimmed) && !priorDigits) {
    return {
      status: "incomplete",
      digits: "",
      message: "Please say your phone number, including the area code.",
    };
  }

  const combined = priorDigits + extractPhoneDigits(trimmed);
  if (!combined.length) {
    return {
      status: "incomplete",
      digits: "",
      message: "Please say your phone number, including the area code.",
    };
  }

  if (combined.length < 10) {
    return {
      status: "incomplete",
      digits: combined,
      message:
        "I only heard part of the phone number so far. Please say the rest, digit by digit.",
    };
  }

  if (combined.length > 11) {
    throw new Error("That phone number seems too long. Could you say it again, digit by digit.");
  }

  const candidate =
    combined.length === 10
      ? combined
      : combined.length === 11 && combined.startsWith("1")
        ? `+${combined}`
        : combined;
  const normalized = tryNormalizeE164(candidate);
  if (!normalized) {
    throw new Error("I didn't catch a valid phone number. Please say it again, digit by digit.");
  }

  return { status: "complete", normalized, digits: combined };
}

function validatePhoneField(raw: string): string {
  const result = captureUsPhoneDigits(raw);
  if (result.status === "incomplete") {
    throw new Error(result.message);
  }
  return result.normalized;
}

function validateNameField(raw: string): string {
  const trimmed = raw.trim();
  if (isReceptionistFieldPlaceholder(trimmed)) {
    throw new Error("Please tell me your full name.");
  }
  if (trimmed.length < 2) {
    throw new Error("Please tell me your full name.");
  }
  if (!/[a-zA-Z]/.test(trimmed)) {
    throw new Error("I didn't catch your name. Could you say your full name again?");
  }
  return trimmed;
}

function validateEmailField(raw: string): string {
  const trimmed = raw.trim();
  if (isReceptionistFieldPlaceholder(trimmed)) {
    throw new Error("Please tell me your email address.");
  }
  const email = trimmed
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("That doesn't look like a valid email. Could you say it again?");
  }
  return email;
}

/**
 * Validate and normalize a receptionist manifest field before persisting.
 * Throws with a caller-friendly message when STT junk or placeholders slip through.
 */
export function validateReceptionistFieldValue(
  field: AgentFieldDefinition,
  raw: string,
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`Please provide your ${field.label}.`);
  }

  switch (field.type) {
    case "phone":
      return validatePhoneField(trimmed);
    case "email":
      return validateEmailField(trimmed);
    default:
      if (field.id === "name") {
        return validateNameField(trimmed);
      }
      if (isReceptionistFieldPlaceholder(trimmed)) {
        throw new Error(`Please provide your ${field.label}.`);
      }
      return trimmed;
  }
}

/** Resolve callback phone for take_message — never pass STT placeholders to normalizeE164. */
export function resolveReceptionistCallbackPhone(input: {
  collectedPhone?: string | null;
  preferredCallback?: string | null;
  callerE164?: string | null;
}): string {
  for (const candidate of [
    input.collectedPhone,
    input.preferredCallback,
    input.callerE164,
  ]) {
    const trimmed = candidate?.trim();
    if (!trimmed || isReceptionistFieldPlaceholder(trimmed)) continue;
    const normalized = tryNormalizeE164(trimmed);
    if (normalized) return normalized;
  }
  return "";
}
