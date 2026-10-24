import type { DialingMode } from "./dial-modes";
import { isMultiLineDialMode, normalizeDialingMode } from "./dial-modes";
import { isConfirmedHumanClassification } from "./answer-classification";

export type ConnectionPolicyContext = {
  dialMode: DialingMode;
  amdFilterMachines: boolean;
  iosScreeningWireActive: boolean;
  screeningPending?: boolean;
  answerClassification?: string | null;
};

export function resolveConnectionPolicy(ctx: ConnectionPolicyContext) {
  const dialMode = normalizeDialingMode(ctx.dialMode);
  const amdGate =
    dialMode === "parallel_amd" ||
    ctx.amdFilterMachines ||
    ctx.iosScreeningWireActive ||
    ctx.screeningPending === true ||
    ctx.answerClassification === "screener";

  const fastConnectOnAnswer =
    !amdGate &&
    (isMultiLineDialMode(dialMode) || dialMode === "power" || dialMode === "preview");

  return {
    dialMode,
    requiresConfirmedHumanBeforeBridge: amdGate,
    fastConnectOnProspectAnswer: fastConnectOnAnswer,
    amdRunsAsync: dialMode === "power" || dialMode === "preview",
  };
}

/** Bridge / winner claim allowed without confirmed-human AMD when policy allows fast connect. */
export function allowsImmediateBridgeOnAnswer(ctx: ConnectionPolicyContext): boolean {
  return resolveConnectionPolicy(ctx).fastConnectOnProspectAnswer;
}

export function bridgeClassificationForFastConnect(): string {
  return "uncertain";
}

export function classificationSatisfiesBridgeGate(
  classification: string | null | undefined,
  ctx: ConnectionPolicyContext,
): boolean {
  const policy = resolveConnectionPolicy(ctx);
  if (!policy.requiresConfirmedHumanBeforeBridge) {
    return (
      classification !== "screener" &&
      ctx.screeningPending !== true &&
      !isMachineLikeForPolicy(classification, ctx.amdFilterMachines)
    );
  }
  return isConfirmedHumanClassification(classification);
}

function isMachineLikeForPolicy(
  classification: string | null | undefined,
  amdFilter: boolean,
): boolean {
  if (!amdFilter) return false;
  return (
    classification === "voicemail" ||
    classification === "machine" ||
    classification === "fax" ||
    classification === "ivr"
  );
}
