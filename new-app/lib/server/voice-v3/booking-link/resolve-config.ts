import { validateBookingLinkUrl } from "@/lib/mctb/booking-links/validate-url";
import type { VoiceV3AgentConfig } from "../config/agent-config";

export type ResolvedSendLinkConfig = {
  strategy: VoiceV3AgentConfig["scheduling"]["bookingStrategy"];
  bookingUrl: string;
  bookingLabel: string;
  businessName: string;
  configVersion: string;
  consentRequired: boolean;
  senderPhoneNumberId: string | null;
  senderE164: string | null;
  outboundSmsMode: string | undefined;
};

export function isSendLinkStrategy(config: VoiceV3AgentConfig): boolean {
  return config.scheduling?.bookingStrategy === "SEND_LINK";
}

export function resolveAuthorizedBookingUrl(config: VoiceV3AgentConfig): string | null {
  const raw =
    config.bookingStrategyDetail?.bookingLinkUrl?.trim() ||
    config.bookingStrategyDetail?.bookingLinkUrl;
  if (!raw) return null;
  const validated = validateBookingLinkUrl(String(raw));
  return validated.ok ? validated.url : null;
}

export function resolveSendLinkConfig(
  config: VoiceV3AgentConfig,
): ResolvedSendLinkConfig | null {
  if (!isSendLinkStrategy(config)) return null;
  const bookingUrl = resolveAuthorizedBookingUrl(config);
  if (!bookingUrl) return null;
  const detail = config.bookingStrategyDetail;
  return {
    strategy: config.scheduling.bookingStrategy,
    bookingUrl,
    bookingLabel: detail?.bookingLinkLabel?.trim() || "Book your appointment",
    businessName: config.businessName?.trim() || "our office",
    configVersion: config.configVersion || "unknown",
    consentRequired: detail?.sendLinkConsentRequired !== false,
    senderPhoneNumberId: config.telephony?.outboundSmsPhoneNumberId ?? null,
    senderE164: config.telephony?.outboundSmsE164 ?? null,
    outboundSmsMode: config.telephony?.outboundSmsMode,
  };
}
