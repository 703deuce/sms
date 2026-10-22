import assert from "node:assert/strict";
import { isSendBookingLinkToolConsentRequired } from "@/lib/server/voice-v3/booking-link/send-link-consent-policy";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";

function minimalConfig(telephony?: VoiceV3AgentConfig["telephony"]): VoiceV3AgentConfig {
  return {
    workspaceId: "ws",
    agentId: "a",
    businessName: "Test",
    timezone: "UTC",
    telephony,
    bookingStrategyDetail: { sendLinkConsentRequired: true },
    scheduling: { bookingStrategy: "SEND_LINK" },
  } as VoiceV3AgentConfig;
}

assert.equal(isSendBookingLinkToolConsentRequired(minimalConfig()), false, "launch mode off but BOOKING_LINK_ONLY is true");
assert.equal(
  isSendBookingLinkToolConsentRequired(
    minimalConfig({ outboundSmsMode: "platform" }),
  ),
  false,
);
assert.equal(
  isSendBookingLinkToolConsentRequired(
    minimalConfig({ outboundSmsMode: "same_as_voice_line" }),
  ),
  false,
  "launch mode forces off",
);

console.log("test-send-link-consent-policy: PASS");
