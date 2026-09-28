/**
 * Authoritative platform-sender consumer message templates (single source for runtime + preview).
 * Audit production TFV-approved copy before changing strings here.
 */
import { DEFAULT_ONBOARDING_MESSAGE } from "@/lib/mctb/onboarding/types";

export type MctbPlatformTemplateId =
  | "recovery_opener"
  | "recovery_opener_concise"
  | "recovery_opener_invite"
  | "stop_confirmation"
  | "help_response";

export type MctbPlatformTemplateDefinition = {
  id: MctbPlatformTemplateId;
  purpose: string;
  trigger: string;
  requiredCapability: "press_one_consent" | "any";
  senderOwnership: "TRANSOVO_PLATFORM";
  body: string;
  allowedSubstitutions: string[];
  runtimeModule: string;
};

export const MCTB_PLATFORM_TEMPLATE_REGISTRY: Record<
  MctbPlatformTemplateId,
  MctbPlatformTemplateDefinition
> = {
  recovery_opener: {
    id: "recovery_opener",
    purpose: "Initial missed-call recovery SMS after consent",
    trigger: "missed_call_recovery_send",
    requiredCapability: "press_one_consent",
    senderOwnership: "TRANSOVO_PLATFORM",
    body: DEFAULT_ONBOARDING_MESSAGE,
    allowedSubstitutions: ["{business_name}", "{booking_link}", "{request_link}"],
    runtimeModule: "src/lib/mctb/message-template.ts",
  },
  recovery_opener_concise: {
    id: "recovery_opener_concise",
    purpose: "Shorter missed-call recovery SMS after consent",
    trigger: "missed_call_recovery_send",
    requiredCapability: "press_one_consent",
    senderOwnership: "TRANSOVO_PLATFORM",
    body: "Sorry we missed your call! How can we help? Reply here and we'll get back to you.",
    allowedSubstitutions: ["{business_name}", "{booking_link}", "{request_link}"],
    runtimeModule: "src/lib/mctb/message-template.ts",
  },
  recovery_opener_invite: {
    id: "recovery_opener_invite",
    purpose: "Missed-call recovery SMS inviting a reply",
    trigger: "missed_call_recovery_send",
    requiredCapability: "press_one_consent",
    senderOwnership: "TRANSOVO_PLATFORM",
    body: "Sorry we missed your call! Text us here and we'll help right away.",
    allowedSubstitutions: ["{business_name}", "{booking_link}", "{request_link}"],
    runtimeModule: "src/lib/mctb/message-template.ts",
  },
  stop_confirmation: {
    id: "stop_confirmation",
    purpose: "Opt-out confirmation after STOP",
    trigger: "consumer_stop",
    requiredCapability: "any",
    senderOwnership: "TRANSOVO_PLATFORM",
    body: "You have been unsubscribed and will not receive further messages. Reply HELP for help.",
    allowedSubstitutions: [],
    runtimeModule: "src/lib/agents/missed-call-text-back/customer-sms.ts",
  },
  help_response: {
    id: "help_response",
    purpose: "HELP keyword response",
    trigger: "consumer_help",
    requiredCapability: "any",
    senderOwnership: "TRANSOVO_PLATFORM",
    body: "Reply STOP to opt out. For help, contact the business that texted you.",
    allowedSubstitutions: ["{business_name}"],
    runtimeModule: "src/lib/agents/missed-call-text-back/customer-sms.ts",
  },
};

export function getMctbPlatformTemplate(id: MctbPlatformTemplateId): MctbPlatformTemplateDefinition {
  return MCTB_PLATFORM_TEMPLATE_REGISTRY[id];
}
