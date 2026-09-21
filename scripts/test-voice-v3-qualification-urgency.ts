import assert from "node:assert/strict";
import { evaluateVoiceV3Qualification } from "../src/lib/voice-v3/qualification/evaluate-qualification";
import { evaluateVoiceV3Urgency } from "../src/lib/voice-v3/urgency/evaluate-urgency";
import { serviceAllowsLiveBooking } from "../src/lib/voice-v3/policy/service-policy";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";

function baseCtx() {
  const clock = buildVoiceV3CallClock("America/New_York");
  return createInitialVoiceV3CallContext({
    callId: "c1",
    liveSessionId: "s1",
    timezone: "America/New_York",
    clock,
  });
}

function baseConfig(patch: Partial<VoiceV3AgentConfig> = {}): VoiceV3AgentConfig {
  return {
    ...VOICE_V3_BOOKING_AGENT_CONFIG,
    qualification: {
      ...VOICE_V3_BOOKING_AGENT_CONFIG.qualification,
      enabled: true,
      requiredBeforePrimaryAction: true,
      supportedZipCodes: ["90210"],
      rules: [
        {
          id: "r1",
          fieldKey: "service_type",
          operator: "EQUALS",
          value: "hvac",
          resultStatus: "QUALIFIED",
        },
      ],
      rulesMatchMode: "ALL",
      notQualifiedFallback: "TAKE_MESSAGE",
      needsReviewFallback: "TAKE_MESSAGE",
      revision: "1",
    },
    callHandling: {
      ...VOICE_V3_BOOKING_AGENT_CONFIG.callHandling,
      urgencyEnabled: true,
      urgencyRules: [
        {
          id: "u1",
          fieldKey: "urgency_flag",
          operator: "EQUALS",
          value: "yes",
          severity: "URGENT",
          action: "TRANSFER",
          transferPlanId: "plan1",
          fallbackAction: "CALLBACK",
        },
      ],
    },
    services: [
      {
        ...VOICE_V3_BOOKING_AGENT_CONFIG.service,
        bookingPermission: "request_only",
      },
    ],
    ...patch,
  };
}

const config = baseConfig();
const ctx = baseCtx();

const blockedZip = evaluateVoiceV3Qualification(config, {
  ...ctx,
  intake: {
    values: {
      zip_code: { value: "00000", source: "caller", updatedAt: new Date().toISOString() },
    },
  },
});
assert.equal(blockedZip.status, "NOT_QUALIFIED");
assert.equal(blockedZip.primaryActionBlocked, true);

const qualified = evaluateVoiceV3Qualification(config, {
  ...ctx,
  intake: {
    values: {
      zip_code: { value: "90210", source: "caller", updatedAt: new Date().toISOString() },
      service_type: { value: "hvac", source: "caller", updatedAt: new Date().toISOString() },
    },
  },
});
assert.equal(qualified.status, "QUALIFIED");
assert.equal(qualified.primaryActionBlocked, false);

const urgent = evaluateVoiceV3Urgency(config, {
  ...ctx,
  intake: {
    values: {
      urgency_flag: { value: "yes", source: "caller", updatedAt: new Date().toISOString() },
    },
  },
});
assert.equal(urgent.matched, true);
assert.equal(urgent.action, "TRANSFER");

assert.equal(serviceAllowsLiveBooking(config.services![0]), false);

console.log("test-voice-v3-qualification-urgency: PASS");
