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

function validatePhoneField(raw: string): string {
  const trimmed = raw.trim();
  if (isReceptionistFieldPlaceholder(trimmed)) {
    throw new Error("Please say your phone number, including the area code.");
  }
  const normalized = tryNormalizeE164(trimmed);
  if (!normalized) {
    throw new Error("I didn't catch a valid phone number. Please say it again, digit by digit.");
  }
  return normalized;
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
