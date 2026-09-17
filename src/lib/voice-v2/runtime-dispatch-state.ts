import type { VoiceV2CallContext } from "./intake/types";
import type { VoiceV2NextStage } from "./booking-workflow";
import { effectiveRequestedDate } from "./scheduling-preference-state";

export type VoiceV2RuntimeDispatchState = {
  inFlightRequiredAction?: string | null;
  lastCompletedDispatchKey?: string | null;
  lastCompletedAt?: string | null;
};

export function runtimeDispatchFromContext(ctx: VoiceV2CallContext): VoiceV2RuntimeDispatchState {
  return ctx.runtimeDispatch ?? {};
}

export function buildRequiredActionDispatchKey(input: {
  ctx: VoiceV2CallContext;
  requiredAction: string;
  stage: VoiceV2NextStage;
  schedulingGeneration: number;
}): string {
  const cycle = input.ctx.dialog?.workflowCycleId ?? 1;
  const date = effectiveRequestedDate(input.ctx) ?? "";
  const slot = input.ctx.bookingState?.selectedSlotId ?? "";
  const offer = input.ctx.currentOfferSet?.offerSetId ?? "";
  return [
    cycle,
    input.stage,
    input.requiredAction,
    input.schedulingGeneration,
    date,
    offer,
    slot,
  ].join("|");
}

export function mergeRuntimeDispatchIntoContext(
  ctx: VoiceV2CallContext,
  patch: Partial<VoiceV2RuntimeDispatchState>,
): VoiceV2CallContext {
  return {
    ...ctx,
    runtimeDispatch: { ...runtimeDispatchFromContext(ctx), ...patch },
  };
}

export function shouldSkipAutoDispatch(input: {
  ctx: VoiceV2CallContext;
  requiredAction: string;
  stage: VoiceV2NextStage;
  schedulingGeneration: number;
}): { skip: boolean; reason?: string } {
  const rd = runtimeDispatchFromContext(input.ctx);
  if (rd.inFlightRequiredAction) {
    return { skip: true, reason: "in_flight" };
  }
  const key = buildRequiredActionDispatchKey(input);
  if (rd.lastCompletedDispatchKey === key) {
    return { skip: true, reason: "already_completed" };
  }
  return { skip: false };
}
