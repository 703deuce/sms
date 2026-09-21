import assert from "node:assert/strict";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "../src/lib/voice-receptionist-wizard/operating-maturity/defaults";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { isVoiceV3ToolAuthorizedEffective } from "../src/lib/voice-v3/policy/effective-tool-authorization";

const closedConfig = {
  ...VOICE_V3_BOOKING_AGENT_CONFIG,
  capabilities: {
    ...VOICE_V3_BOOKING_AGENT_CONFIG.capabilities,
    bookAppointments: true,
    checkAvailability: true,
  },
  operatingPolicy: {
    businessSchedule: {
      ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule,
      timezone: "UTC",
      weekly: {
        monday: { closed: true, ranges: [] },
        tuesday: { closed: true, ranges: [] },
        wednesday: { closed: true, ranges: [] },
        thursday: { closed: true, ranges: [] },
        friday: { closed: true, ranges: [] },
        saturday: { closed: true, ranges: [] },
        sunday: { closed: true, ranges: [] },
      },
      holidays: [],
    },
    afterHoursBehavior: {
      useOperatingStateDuringCalls: true,
      whenClosed: {
        allowLiveBooking: false,
        allowCallbackRequest: true,
        allowMessageTaking: true,
        allowOnCallEscalation: false,
        allowOfficeTransfer: false,
        allowNormalTransferDestinations: false,
      },
    },
  },
};

// Monday 2026-09-21 midday UTC — all days closed in schedule
const at = "2026-09-21T12:00:00.000Z";

assert.equal(
  isVoiceV3ToolAuthorizedEffective(closedConfig, "find_availability", at),
  false,
);
assert.equal(
  isVoiceV3ToolAuthorizedEffective(closedConfig, "request_callback", at),
  true,
);

console.log("test-voice-v3-operating-policy-gating: PASS");
