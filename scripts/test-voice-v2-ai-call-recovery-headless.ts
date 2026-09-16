/**
 * Voice V2 AI Call Recovery — deterministic evaluator + resolution headless cert.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-ai-call-recovery-headless.ts
 */
import assert from "node:assert/strict";

import { evaluateAiCallRecovery } from "../src/lib/voice-v2/ai-call-recovery/evaluate";
import { resolveVoiceV2ResolutionStatus } from "../src/lib/voice-v2/ai-call-recovery/resolution-status";
import {
  DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG,
  type VoiceV2RecoveryEvaluationInput,
} from "../src/lib/voice-v2/ai-call-recovery/types";
import { defaultVoiceV2BookingWorkflow } from "../src/lib/voice-v2/booking-workflow";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";

function baseEligibility(): VoiceV2RecoveryEvaluationInput["messagingEligibility"] {
  return {
    recoveryEnabled: true,
    consentMode: "EXISTING_CONSENT",
    validDestination: true,
    validSendingRoute: true,
    notOptedOut: true,
    notSuppressed: true,
    callerIdKnown: true,
    recoveryAlreadySent: false,
    activeRecoveryCooldown: false,
    landlineOrNonSmsDestination: false,
  };
}

function baseInput(
  partial: Partial<VoiceV2RecoveryEvaluationInput>,
): VoiceV2RecoveryEvaluationInput {
  return {
    callState: {},
    resolutionStatus: "UNRESOLVED_ABANDONED",
    primaryOutcome: "NONE",
    messagingEligibility: baseEligibility(),
    pinnedConfig: {
      ...DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG,
      enabled: true,
      consentMode: "EXISTING_CONSENT",
    },
    triggers: DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG.triggers,
    sendWhenCallbackAlreadyCreated: false,
    ...partial,
  };
}

// FAQ success — no recovery
{
  const r = evaluateAiCallRecovery(
    baseInput({
      resolutionStatus: "RESOLVED_INFORMATION_ONLY",
      callState: { informationOnlyResolved: true },
    }),
  );
  assert.equal(r.delivery, "NO_SMS");
}

// Booking race — settled success
{
  const r = evaluateAiCallRecovery(
    baseInput({
      resolutionStatus: "RESOLVED_SUCCESS",
      primaryOutcome: "BOOKED",
    }),
  );
  assert.equal(r.delivery, "NO_SMS");
}

// Booking interrupted
{
  const r = evaluateAiCallRecovery(
    baseInput({
      bookingPendingAtHangup: true,
      bookingState: { offerSetId: "offer_1", selectedSlotId: "slot_1" },
    }),
  );
  assert.equal(r.delivery, "SEND_RECOVERY_SMS");
  if (r.delivery === "SEND_RECOVERY_SMS") {
    assert.equal(r.recoverySubtype, "BOOKING_INTERRUPTED");
  }
}

// Silent abandonment
{
  const r = evaluateAiCallRecovery(
    baseInput({
      callerSpeechState: { meaningfulUtteranceCount: 0 },
    }),
  );
  if (r.delivery === "SEND_RECOVERY_SMS") {
    assert.equal(r.recoverySubtype, "SILENT_ABANDONMENT");
  }
}

// Landline suppression
{
  const r = evaluateAiCallRecovery(
    baseInput({
      messagingEligibility: {
        ...baseEligibility(),
        landlineOrNonSmsDestination: true,
        validDestination: false,
      },
    }),
  );
  assert.equal(r.delivery, "NO_SMS");
  assert.match(r.reason, /non_sms_destination|invalid_destination/);
}

// Callback ack path
{
  const r = evaluateAiCallRecovery(
    baseInput({
      callbackState: { success: true, created: true },
    }),
  );
  assert.equal(r.delivery, "SEND_CALLBACK_ACK_SMS");
}

// AI refusal
{
  const r = evaluateAiCallRecovery(
    baseInput({
      callState: { declinedAiChannel: true },
      resolutionStatus: "DECLINED_AI_CHANNEL",
    }),
  );
  if (r.delivery === "SEND_RECOVERY_SMS") {
    assert.equal(r.recoverySubtype, "AI_CHANNEL_DECLINED");
  }
}

// Resolution from context — booked
{
  const ctx: VoiceV2CallContext = {
    sessionKey: "test",
    workspaceId: "w",
    agentId: "a",
    businessTimezone: "America/New_York",
    intakeSchema: { fields: [] },
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingConfirmed: true,
    },
  };
  const status = resolveVoiceV2ResolutionStatus({ ctx });
  assert.equal(status, "RESOLVED_SUCCESS");
}

console.log("test-voice-v2-ai-call-recovery-headless: PASS");
