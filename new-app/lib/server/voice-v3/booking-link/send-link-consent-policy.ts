import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";
import { isPlatformOutboundSmsMode } from "@/lib/voice/sms/voice-outbound-sms-constants";
import type { VoiceV3AgentConfig } from "../config/agent-config";

/**
 * Tool-level SMS consent gate for send_booking_link (verbal yes + disclosure loop).
 * Separate from carrier/A2P sender authorization — platform sends skip this gate.
 */
export function isSendBookingLinkToolConsentRequired(config: VoiceV3AgentConfig): boolean {
  if (isBookingLinkOnlyLaunch()) return false;
  if (isPlatformOutboundSmsMode(config.telephony?.outboundSmsMode)) return false;
  return config.bookingStrategyDetail?.sendLinkConsentRequired !== false;
}
