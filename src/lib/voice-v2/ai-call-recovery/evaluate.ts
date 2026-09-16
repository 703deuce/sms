import { primaryOutcomeSucceeded } from "../primary-outcome";
import type {
  VoiceV2RecoveryDeliveryDecision,
  VoiceV2RecoveryEvaluationInput,
  VoiceV2RecoveryEvaluationResult,
  VoiceV2RecoverySubtype,
} from "./types";

function subtypeAllowed(
  subtype: VoiceV2RecoverySubtype,
  triggers: VoiceV2RecoveryEvaluationInput["triggers"],
): boolean {
  switch (subtype) {
    case "SILENT_ABANDONMENT":
      return triggers.silentAbandonment;
    case "PARTIAL_INTAKE":
      return triggers.partialIntake;
    case "BOOKING_INTERRUPTED":
      return triggers.bookingInterrupted;
    case "PROVIDER_FAILURE":
      return triggers.providerFailure;
    case "TRANSFER_INTERRUPTED":
      return triggers.transferInterrupted;
    case "TRANSFER_FAILED":
      return triggers.transferFailed;
    case "AI_CHANNEL_DECLINED":
      return triggers.declinedAi;
    case "GENERAL_UNRESOLVED":
      return triggers.generalUnresolved;
    default:
      return false;
  }
}

function classifyRecoverySubtype(input: VoiceV2RecoveryEvaluationInput): VoiceV2RecoverySubtype {
  if (input.callState.declinedAiChannel) return "AI_CHANNEL_DECLINED";
  if (input.providerFailureAuthoritative) return "PROVIDER_FAILURE";
  const transferStatus = input.transferState?.status;
  if (transferStatus === "INITIATING" || transferStatus === "RINGING") {
    return "TRANSFER_INTERRUPTED";
  }
  if (transferStatus === "FAILED") return "TRANSFER_FAILED";
  if (input.bookingPendingAtHangup || input.bookingState?.offerSetId) {
    return "BOOKING_INTERRUPTED";
  }
  if (input.partialIntakeEvidence) return "PARTIAL_INTAKE";
  const meaningful = input.callerSpeechState?.meaningfulUtteranceCount ?? 0;
  if (meaningful === 0) return "SILENT_ABANDONMENT";
  return "GENERAL_UNRESOLVED";
}

function absoluteSendGates(input: VoiceV2RecoveryEvaluationInput): string | null {
  const e = input.messagingEligibility;
  if (!e.recoveryEnabled) return "recovery_disabled";
  if (!input.pinnedConfig.enabled) return "config_disabled";
  if (input.pinnedConfig.consentMode === "DISABLED") return "consent_disabled";
  if (!e.validDestination) return "invalid_destination";
  if (!e.validSendingRoute) return "invalid_sending_route";
  if (!e.notOptedOut) return "opted_out";
  if (!e.notSuppressed) return "suppressed";
  if (!e.callerIdKnown) return "caller_unknown";
  if (input.callState.isTest) return "test_call";
  if (input.callState.isSpam) return "spam_flow";
  if (e.landlineOrNonSmsDestination) return "non_sms_destination";
  if (e.recoveryAlreadySent) return "already_sent";
  if (e.activeRecoveryCooldown) return "recovery_cooldown";
  return null;
}

/**
 * Deterministic two-level recovery evaluator.
 * Level 1: delivery class. Level 2: recovery subtype when SEND_RECOVERY_SMS.
 */
export function evaluateAiCallRecovery(
  input: VoiceV2RecoveryEvaluationInput,
): VoiceV2RecoveryEvaluationResult {
  const gate = absoluteSendGates(input);
  if (gate) return { delivery: "NO_SMS", reason: gate };

  const { resolutionStatus, primaryOutcome } = input;

  if (resolutionStatus === "NON_CUSTOMER_CALL") {
    return { delivery: "NO_SMS", reason: "non_customer_call" };
  }

  if (resolutionStatus === "RESOLVED_SUCCESS" || resolutionStatus === "RESOLVED_INFORMATION_ONLY") {
    return { delivery: "NO_SMS", reason: "resolved" };
  }

  if (primaryOutcomeSucceeded(primaryOutcome)) {
    return { delivery: "NO_SMS", reason: "primary_outcome_succeeded" };
  }

  if (input.transferState?.bridgeSucceeded) {
    return { delivery: "NO_SMS", reason: "transfer_succeeded" };
  }

  const callbackOk = input.callbackState?.success || input.callbackState?.created;
  if (callbackOk && !input.pinnedConfig.sendWhenCallbackAlreadyCreated) {
    return {
      delivery: "SEND_CALLBACK_ACK_SMS",
      reason: "callback_ack_delegated",
    };
  }

  if (input.callState.informationOnlyResolved) {
    return { delivery: "NO_SMS", reason: "information_only" };
  }

  const subtype = classifyRecoverySubtype(input);
  if (!subtypeAllowed(subtype, input.triggers)) {
    return { delivery: "NO_SMS", reason: `trigger_disabled:${subtype}` };
  }

  if (!input.pinnedConfig.continueOverSms && subtype !== "SILENT_ABANDONMENT") {
    return { delivery: "NO_SMS", reason: "continuation_disabled" };
  }

  const delivery: VoiceV2RecoveryDeliveryDecision = "SEND_RECOVERY_SMS";
  return {
    delivery,
    recoverySubtype: subtype,
    reason: `recovery:${subtype}`,
  };
}
