import type { LeadRecoveryCollectField } from "@/lib/mctb/lead-recovery/types";
const FIELD_PROMPTS: Record<LeadRecoveryCollectField, string> = {
  NAME: "What's your name?",
  EMAIL: "What's the best email for you?",
  PHONE: "What number should we use to reach you?",
  ADDRESS: "What's the service address?",
  REASON: "What can we help you with today?",
  SERVICE_CATEGORY: "What type of service do you need?",
  ISSUE_DESCRIPTION: "Can you briefly describe the issue?",
  URGENCY: "Is this urgent right now, or can it wait?",
  CALLBACK_NUMBER: "What number should we call you on?",
  CALLBACK_TIME: "When is a good time to call you back?",
  APPOINTMENT_PREFERENCE: "What day or time works best for you?",
};

export function promptForCollectField(field: LeadRecoveryCollectField): string {
  return FIELD_PROMPTS[field] || "Could you share a bit more detail?";
}

const EMAIL_SYNTAX_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Deterministic validation/normalization only — values must come from the intent LLM. */
export function validateAndNormalizeCollectedField(
  field: LeadRecoveryCollectField,
  raw: string,
): string | null {
  const text = raw.trim();
  if (!text) return null;

  if (field === "EMAIL") {
    const candidate = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? text;
    return EMAIL_SYNTAX_RE.test(candidate) ? candidate : null;
  }

  if (field === "PHONE") {
    const digits = text.replace(/\D/g, "");
    if (digits.length < 10) return null;
    return text.replace(/\s+/g, " ").trim().slice(0, 32);
  }

  if (field === "URGENCY") {
    const u = text.toUpperCase();
    if (u === "EMERGENCY" || u === "HIGH" || u === "NORMAL" || u === "LOW") return u;
    return null;
  }

  if (field === "ADDRESS") {
    return text.slice(0, 500);
  }

  if (
    field === "APPOINTMENT_PREFERENCE" ||
    field === "CALLBACK_TIME" ||
    field === "REASON" ||
    field === "ISSUE_DESCRIPTION" ||
    field === "NAME" ||
    field === "SERVICE_CATEGORY" ||
    field === "CALLBACK_NUMBER"
  ) {
    return text.length >= 2 ? text.slice(0, 500) : null;
  }

  return text.slice(0, 500);
}
