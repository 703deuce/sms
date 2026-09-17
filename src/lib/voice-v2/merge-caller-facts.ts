import "server-only";

import type { VoiceCallerIntentInterpretation } from "./caller-intent-interpreter";
import { dialogFromContext, isActiveBookingGoal } from "./dialog-goal";
import {
  deriveVoiceV2NextStage,
  mergeWorkflowIntoContext,
  workflowFromContext,
  type VoiceV2BookingWorkflow,
} from "./booking-workflow";
import { getIntakeReadiness } from "./intake/readiness";
import type { VoiceV2CallContext } from "./intake/types";
import {
  extractSchedulingFromCallerSpeech,
  mergeSchedulingPreferenceRecord,
  syncWorkflowRequestedDateFromScheduling,
  type VoiceV2SchedulingPreference,
} from "./scheduling-preference-state";

export type MergeCallerFactsInput = {
  utterance: string;
  interpretation: VoiceCallerIntentInterpretation;
  evidence?: string;
  now?: Date;
};

export type MergeCallerFactsResult = {
  ctx: VoiceV2CallContext;
  schedulingChanged: boolean;
};

/**
 * Deterministic fact capture — independent of workflow stage and SAVE tool timing.
 * Interpreter proposes; runtime validates, normalizes, and persists.
 */
export function mergeCallerFactsIntoCallContext(
  ctx: VoiceV2CallContext,
  input: MergeCallerFactsInput,
): MergeCallerFactsResult {
  if (input.interpretation.digression) {
    return { ctx, schedulingChanged: false };
  }

  let next = { ...ctx };
  let schedulingChanged = false;
  let workflow: VoiceV2BookingWorkflow = { ...workflowFromContext(next) };

  if (isActiveBookingGoal(input.interpretation.intent) || isActiveBookingGoal(dialogFromContext(next).activeGoal)) {
    workflow = { ...workflow, bookingIntentActive: true };
  }

  const schedulingPatch = extractSchedulingFromCallerSpeech({
    utterance: input.utterance,
    timezone: next.businessTimezone,
    now: input.now,
    entities: input.interpretation.entities,
  });

  if (schedulingPatch && (schedulingPatch.requestedDate || schedulingPatch.requestedDaypart || schedulingPatch.requestedTime)) {
    const prior = next.schedulingPreference;
    const mergedPref = mergeSchedulingPreferenceRecord(prior, schedulingPatch);
    const priorJson = JSON.stringify(prior ?? {});
    const nextJson = JSON.stringify(mergedPref);
    if (priorJson !== nextJson) {
      schedulingChanged = true;
      next = { ...next, schedulingPreference: mergedPref };
      workflow = syncWorkflowRequestedDateFromScheduling(workflow, mergedPref);
    }
  }

  const readiness = getIntakeReadiness(next.intakeSchema, next.intakeState);
  const hasOffer =
    Boolean(next.currentOfferSet?.offerSetId) &&
    (next.currentOfferSet?.slotIds?.length ?? 0) > 0;
  const strategy = next.capabilities?.bookingStrategy ?? "MICROSOFT_365";

  workflow = {
    ...workflow,
    nextStage: deriveVoiceV2NextStage({
      workflow,
      readiness,
      hasActiveOfferSet: hasOffer,
      bookingStrategy: strategy,
      schedulingPreference: next.schedulingPreference,
    }),
  };

  next = mergeWorkflowIntoContext(next, workflow);
  return { ctx: next, schedulingChanged };
}

/** Re-derive workflow stage after any context mutation (intake save, FIND, etc.). */
export function rederiveWorkflowStageForContext(ctx: VoiceV2CallContext): VoiceV2CallContext {
  let workflow = syncWorkflowRequestedDateFromScheduling(
    workflowFromContext(ctx),
    ctx.schedulingPreference,
  );
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const hasOffer =
    Boolean(ctx.currentOfferSet?.offerSetId) && (ctx.currentOfferSet?.slotIds?.length ?? 0) > 0;
  const strategy = ctx.capabilities?.bookingStrategy ?? "MICROSOFT_365";
  workflow = {
    ...workflow,
    nextStage: deriveVoiceV2NextStage({
      workflow,
      readiness,
      hasActiveOfferSet: hasOffer,
      bookingStrategy: strategy,
      schedulingPreference: ctx.schedulingPreference,
    }),
  };
  return mergeWorkflowIntoContext(ctx, workflow);
}
