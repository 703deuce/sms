import type { VoiceV2CallContext } from "../intake/types";
import { resolveVoiceV2PrimaryOutcome } from "../primary-outcome";
import type { VoiceV2ResolutionAuditStatus } from "./types";

export function normalizeVoiceV2ResolutionAudit(input: {
  ctx?: VoiceV2CallContext | null;
  callMeta?: Record<string, unknown>;
  durationSeconds?: number;
}): VoiceV2ResolutionAuditStatus {
  const meta = input.callMeta || {};
  const ctx = input.ctx;

  if (meta.voiceV2SpamCall === true) return "NON_CUSTOMER_CALL";
  if (meta.voiceV2DeclinedAiChannel === true) return "AI_REFUSAL";
  if (meta.voiceV2ProviderFailure === true) return "PROVIDER_FAILURE";

  const transfer = ctx?.afterHours?.transfer?.status;
  if (transfer === "FAILED") return "TRANSFER_FAILURE";

  if (ctx?.bookingWorkflow?.bookingConfirmed) return "RESOLVED_SUCCESS";
  if (meta.voiceV2InformationOnlyResolved === true) return "RESOLVED_INFORMATION_ONLY";

  const outcome = ctx ? resolveVoiceV2PrimaryOutcome(ctx) : "NONE";
  if (outcome === "BOOKED" || outcome === "CALLBACK_REQUESTED" || outcome === "MESSAGE_TAKEN") {
    return "RESOLVED_SUCCESS";
  }

  const duration = input.durationSeconds ?? 0;
  const meaningful = Number(meta.voiceV2MeaningfulUtterances ?? 0);
  if (meaningful === 0 && duration > 0 && duration < 25) {
    return "ABANDONED_BEFORE_INTENT";
  }
  const pendingBook =
    ctx?.bookingWorkflow?.nextStage === "BOOK_SELECTED_SLOT" ||
    Boolean(ctx?.bookingState?.selectedSlotId);
  const transferPending =
    transfer === "INITIATING" || transfer === "RINGING" || transfer === "REQUESTED";

  if (transferPending) return "ABANDONED_DURING_TRANSFER";
  if (pendingBook) return "ABANDONED_DURING_BOOKING";
  if (meaningful >= 2 && !ctx?.bookingWorkflow?.bookingConfirmed) {
    return "ABANDONED_DURING_INTAKE";
  }

  if (meta.voiceV2HumanRequest === true && transfer !== "SUCCEEDED") {
    return "AI_UNABLE_TO_HELP";
  }

  return "UNRESOLVED_ABANDONED";
}

export function isLegitimateResolutionDenominator(input: {
  resolution: VoiceV2ResolutionAuditStatus;
  isTest?: boolean;
}): boolean {
  if (input.isTest) return false;
  return input.resolution !== "NON_CUSTOMER_CALL";
}

export function isResolvedForRate(resolution: VoiceV2ResolutionAuditStatus): boolean {
  return (
    resolution === "RESOLVED_SUCCESS" ||
    resolution === "RESOLVED_INFORMATION_ONLY" ||
    resolution === "PARTIALLY_RESOLVED"
  );
}

export function computeResolutionRate(input: {
  totalLegitimate: number;
  resolved: number;
}): number | null {
  if (input.totalLegitimate <= 0) return null;
  return input.resolved / input.totalLegitimate;
}
