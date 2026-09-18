import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";

/** Unit tests: same intake as production booking pipeline + mock calendar connection id. */
export const VOICE_V3_BOOKING_TEST_CONFIG = {
  ...VOICE_V3_BOOKING_AGENT_CONFIG,
  calendar: {
    ...VOICE_V3_BOOKING_AGENT_CONFIG.calendar!,
    connectionId: "voice_v3_unit_test_connection",
  },
};
