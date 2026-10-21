import type { ConversationalRoute } from "@/lib/agent";

export type PhoneNormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; message: string };

/** Client-safe E.164 normalization for US-style numbers entered in the UI. */
export function tryNormalizePhoneInput(raw: string): PhoneNormalizeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Phone number is required." };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10) {
    return { ok: false, message: "Enter a valid 10-digit phone number." };
  }
  if (trimmed.startsWith("+")) {
    if (digits.length < 11) {
      return { ok: false, message: "Enter a complete international number starting with +." };
    }
    return { ok: true, e164: `+${digits}` };
  }
  if (digits.length === 10) {
    return { ok: true, e164: `+1${digits}` };
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return { ok: true, e164: `+${digits}` };
  }
  return { ok: false, message: "Enter a valid US phone number or +E.164." };
}

/** Text compiled into published transfer route descriptions for the AI. */
export function buildConversationalRouteAiDescription(route: ConversationalRoute): string {
  const parts: string[] = [];
  const who = route.description?.trim();
  const when = route.intentDescription?.trim();
  if (who) parts.push(who);
  if (when) parts.push(`When to transfer: ${when}`);
  const examples = (route.examples ?? []).filter(Boolean);
  if (examples.length) {
    parts.push(`Examples: ${examples.join("; ")}`);
  }
  return parts.join(" ") ||
    "Use when the caller's intent matches this route based on natural conversation — not exact keywords.";
}

export const CONVERSATIONAL_ROUTE_EXAMPLE: Pick<
  ConversationalRoute,
  "name" | "description" | "intentDescription" | "destinationPhoneE164"
> = {
  name: "Sales Department",
  description: "New customers, pricing inquiries, estimates and quotes.",
  intentDescription:
    "When someone wants to discuss a new service, get an estimate, ask about prices, or speak to Sales.",
  destinationPhoneE164: "+15715550134",
};
