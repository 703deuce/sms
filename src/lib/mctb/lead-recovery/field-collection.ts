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

export function tryExtractFieldFromMessage(
  field: LeadRecoveryCollectField,
  message: string,
): string | null {
  const text = message.trim();
  if (!text) return null;
  if (field === "EMAIL" && /\S+@\S+\.\S+/.test(text)) {
    return text.match(/\S+@\S+\.\S+/)?.[0] ?? null;
  }
  if (field === "PHONE" && /\+?\d[\d\s().-]{7,}/.test(text)) {
    return text.replace(/\s+/g, " ").trim();
  }
  if (field === "URGENCY") {
    if (/\b(urgent|emergency|asap|right now)\b/i.test(text)) return "EMERGENCY";
    if (/\b(not urgent|whenever|no rush)\b/i.test(text)) return "NORMAL";
  }
  if (field === "ADDRESS" && /\d+\s+\w+/.test(text) && text.length > 8) {
    return text;
  }
  if (field === "APPOINTMENT_PREFERENCE" || field === "CALLBACK_TIME") {
    if (text.length >= 2) return text;
  }
  if (
    field === "REASON" ||
    field === "ISSUE_DESCRIPTION" ||
    field === "NAME" ||
    field === "SERVICE_CATEGORY"
  ) {
    if (text.length >= 2) return text;
  }
  return null;
}
