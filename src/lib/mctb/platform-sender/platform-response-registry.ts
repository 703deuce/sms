import type { PlatformResponseId } from "@/lib/mctb/platform-sender/platform-response-ids";

export type PlatformResponseVariableKey =
  | "businessName"
  | "bookingUrl"
  | "callerFirstName";

const TEMPLATES: Record<
  PlatformResponseId,
  { template: string; allowedVariables: PlatformResponseVariableKey[] }
> = {
  ACKNOWLEDGE_NEED: {
    template: "Thanks — we're on it. What else can you share so {{businessName}} can help?",
    allowedVariables: ["businessName"],
  },
  ASK_NAME: {
    template: "What's your name?",
    allowedVariables: [],
  },
  ASK_NEED: {
    template: "What can we help you with today?",
    allowedVariables: [],
  },
  ASK_LOCATION: {
    template: "What's the service address?",
    allowedVariables: [],
  },
  ASK_URGENCY: {
    template: "Is this urgent right now, or can it wait?",
    allowedVariables: [],
  },
  ASK_CALLBACK_TIME: {
    template: "When is a good time to call you back?",
    allowedVariables: [],
  },
  CALLBACK_CONFIRMED: {
    template: "Got it — {{businessName}} will call you back soon.",
    allowedVariables: ["businessName"],
  },
  SEND_BOOKING_LINK: {
    template: "You can book here: {{bookingUrl}}",
    allowedVariables: ["businessName", "bookingUrl"],
  },
  HANDOFF_OWNER_FOLLOWUP: {
    template: "Thanks — someone from {{businessName}} will follow up shortly.",
    allowedVariables: ["businessName"],
  },
  OPT_OUT_ACK: {
    template: "You've been unsubscribed. Reply START to resubscribe.",
    allowedVariables: [],
  },
  SAFE_FALLBACK: {
    template: "Thanks for your message — {{businessName}} will follow up soon.",
    allowedVariables: ["businessName"],
  },
};

export function getPlatformResponseTemplate(id: PlatformResponseId) {
  return TEMPLATES[id];
}

export function renderPlatformResponseTemplate(
  id: PlatformResponseId,
  variables: Partial<Record<PlatformResponseVariableKey, string>>,
): string {
  const def = TEMPLATES[id];
  if (!def) {
    return renderPlatformResponseTemplate("SAFE_FALLBACK", variables);
  }
  let out = def.template;
  for (const key of def.allowedVariables) {
    const value = variables[key];
    if (!value?.trim()) {
      if (id === "SEND_BOOKING_LINK" && key === "bookingUrl") {
        throw new Error("platform_response_missing_booking_url");
      }
      if (key === "businessName") {
        out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), "our team");
        continue;
      }
      throw new Error(`platform_response_missing_variable:${key}`);
    }
    const safe = value.trim().slice(0, 500);
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), safe);
  }
  if (/\{\{[a-zA-Z]+\}\}/.test(out)) {
    throw new Error("platform_response_unresolved_placeholder");
  }
  return out.trim();
}
