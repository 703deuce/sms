import type { ResolvedSendLinkConfig } from "./resolve-config";

/**
 * Deterministic outbound SMS for booking-link strategy — not model-generated.
 */
export function buildSendBookingLinkSmsBody(input: {
  config: ResolvedSendLinkConfig;
}): string {
  const envTemplate = process.env.VOICE_BOOKING_LINK_SMS_TEMPLATE?.trim();
  if (envTemplate) {
    return envTemplate
      .replaceAll("{BUSINESS_NAME}", input.config.businessName)
      .replaceAll("{BOOKING_URL}", input.config.bookingUrl)
      .replaceAll("{BOOKING_LABEL}", input.config.bookingLabel);
  }

  return `${input.config.businessName}: Book your appointment here:\n${input.config.bookingUrl}\nMsg & data rates may apply. Reply STOP to opt out, HELP for help.`;
}
