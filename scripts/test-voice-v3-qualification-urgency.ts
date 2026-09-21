import assert from "node:assert/strict";
import { evaluateVoiceV3Qualification } from "../src/lib/voice-v3/qualification/evaluate-qualification";
import { evaluateVoiceV3Urgency } from "../src/lib/voice-v3/urgency/evaluate-urgency";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import type { VoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";

function baseCtx(): VoiceV3CallContext {
  return {
    callId: "c1",
    liveSessionId: "s1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    business: { timezone: "America/New_York" },
    telephony: { inboundCallerE164: "+15551234567" },
    clock: { nowIso: new Date().toISOString(), timezone: "America/New_York" },
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
    intake: { values: {} },
    scheduling: { generation: 0 },
    availability: {
      status: "idle",
      activeOfferSet: null,
      lastFailure: null,
      inFlightGeneration: null,
      lastDispatchedRequestKey: null,
      findStartedAt: null,
    },
    recovery: { active: null },
    presentation: { current: null },
    selection: { selected: null, lastResolutionStatus: null },
    booking: {
      phase: "NONE",
      activeAttempt: null,
      confirmed: null,
      lastFailure: null,
      postBookChangeRequested: false,
      verbalConfirmation: "NOT_REQUIRED",
    },
    appointmentManagement: {
      lookupCompleted: false,
      verifiedExisting: null,
      lastCancellationConfirmation: null,
      reschedule: { phase: "NONE" },
      cancellation: { phase: "NONE", awaitingConfirmation: false },
    },
    operations: {},
    runtime: { version: 0 },
  };
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
          value: "emergency",
          severity: "CRITICAL",
          action: "TRANSFER",
        },
      ],
    },
    ...patch,
  };
}

const ctx = baseCtx();
ctx.intake.values.zip_code = {
  value: "90210",
  source: "caller",
  updatedAt: new Date().toISOString(),
};

let q = evaluateVoiceV3Qualification(baseConfig(), ctx);
assert.equal(q.primaryActionBlocked, true);

ctx.intake.values.service_type = {
  value: "hvac",
  source: "caller",
  updatedAt: new Date().toISOString(),
};
q = evaluateVoiceV3Qualification(baseConfig(), ctx);
assert.equal(q.status, "QUALIFIED");
assert.equal(q.primaryActionBlocked, false);

ctx.intake.values.urgency_flag = {
  value: "emergency",
  source: "caller",
  updatedAt: new Date().toISOString(),
};
const u = evaluateVoiceV3Urgency(baseConfig(), ctx);
assert.equal(u.matched, true);
assert.equal(u.severity, "CRITICAL");

console.log("test-voice-v3-qualification-urgency: PASS");
