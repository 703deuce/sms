import type { VoiceV2NextStage } from "./booking-workflow";
import type { VoiceV2CallContext } from "./intake/types";
import { getRegistryEntry } from "./live-tool-registry";

/** Tools the runtime executes via auto-dispatch — backend model must not duplicate. */
export function computeRuntimeOwnedActions(
  ctx: VoiceV2CallContext,
  stage: VoiceV2NextStage,
  requiredAction: string | null | undefined,
): string[] {
  const required = String(requiredAction || "").trim();
  if (!required) return [];
  const contract = getRegistryEntry(required);
  if (!contract?.autoDispatchEligible) return [];
  if (!contract.canRun(ctx, stage)) return [];
  return [required];
}

export function isRuntimeOwnedTool(
  toolName: string,
  runtimeOwned: string[],
): boolean {
  return runtimeOwned.includes(toolName);
}

export function delegationAllowedActions(
  allowedNextActions: string[],
  runtimeOwned: string[],
): string[] {
  if (!runtimeOwned.length) return allowedNextActions;
  const owned = new Set(runtimeOwned);
  return allowedNextActions.filter((a) => !owned.has(a));
}
