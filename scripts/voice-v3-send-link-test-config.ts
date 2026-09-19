import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

export const VOICE_V3_SEND_LINK_TEST_URL = "https://example.com/transovo-cert-book";

export const VOICE_V3_SEND_LINK_TEST_CONFIG = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  configVersion: "send_link_test_v1",
  scheduling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.scheduling,
    bookingStrategy: "SEND_LINK" as const,
  },
  bookingStrategyDetail: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.bookingStrategyDetail,
    strategy: "SEND_LINK" as const,
    executionStatus: "ACTIVE_EXECUTION" as const,
    bookingLinkUrl: VOICE_V3_SEND_LINK_TEST_URL,
    bookingLinkLabel: "Book your appointment",
    sendLinkConsentRequired: true,
  },
  telephony: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.telephony,
    outboundSmsMode: "explicit_number",
    outboundSmsE164: "+15717491060",
    outboundSmsPhoneNumberId: "pn_send_link_test",
  },
};
