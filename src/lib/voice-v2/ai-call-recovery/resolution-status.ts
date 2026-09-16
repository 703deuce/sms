import type { VoiceV2CallContext } from "../intake/types";
import { resolveVoiceV2PrimaryOutcome, primaryOutcomeSucceeded } from "../primary-outcome";
import type { VoiceV2ResolutionStatus } from "./types";

export type ResolveResolutionStatusInput = {
  ctx: VoiceV2CallContext | null;
  callMeta?: {
    isSpam?: boolean;
    informationOnlyResolved?: boolean;
    declinedAiChannel?: boolean;
    providerFailure?: boolean;
  };
  durationSeconds?: number;
  meaningfulCallerUtterances?: number;
};

export function resolveVoiceV2ResolutionStatus(
  input: ResolveResolutionStatusInput,
): VoiceV2ResolutionStatus {
  if (input.callMeta?.isSpam) return "NON_CUSTOMER_CALL";

  const ctx = input.ctx;
  const primary = ctx ? resolveVoiceV2PrimaryOutcome(ctx) : "NONE";

  if (input.callMeta?.informationOnlyResolved) {
    return "RESOLVED_INFORMATION_ONLY";
  }

  if (primaryOutcomeSucceeded(primary)) {
    return "RESOLVED_SUCCESS";
  }

  if (input.callMeta?.declinedAiChannel) {
    return "DECLINED_AI_CHANNEL";
  }

  const transfer = ctx?.afterHours?.transfer?.status;
  if (transfer === "FAILED") return "UNRESOLVED_TRANSFER_FAILURE";

  if (input.callMeta?.providerFailure) return "UNRESOLVED_PROVIDER_FAILURE";

  const hasPartial =
    (input.meaningfulCallerUtterances ?? 0) > 0 &&
    Boolean(ctx?.intakeState && Object.keys(ctx.intakeState).length > 0);

  if (hasPartial && !ctx?.bookingWorkflow?.bookingConfirmed) {
    return "PARTIALLY_RESOLVED";
  }

  return "UNRESOLVED_ABANDONED";
}
