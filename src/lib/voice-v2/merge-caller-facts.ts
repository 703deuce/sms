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
  utteranceLooksLikeSchedulingCorrection,
  type VoiceV2SchedulingPreference,
} from "./scheduling-preference-state";
import { mergeUtteranceIntakeFactsIntoContext } from "./intake/apply-intake-facts";
import { resolveSelectedSlotIdFromOffer } from "./resolve-slot-from-offer";
import { loadVoiceV2OfferSet } from "./offer-set-store";

export type MergeCallerFactsInput = {
  utterance: string;
  interpretation: VoiceCallerIntentInterpretation;
  evidence?: string;
  now?: Date;
  turnId?: string;
};

export type MergeCallerFactsResult = {
  ctx: VoiceV2CallContext;
  schedulingChanged: boolean;
  intakeFieldsSaved: import("./intake/types").IntakeFieldKey[];
};

/**
 * Deterministic fact capture — independent of workflow stage and SAVE tool timing.
 * Interpreter proposes; runtime validates, normalizes, and persists.
 */
export async function mergeCallerFactsIntoCallContext(
  ctx: VoiceV2CallContext,
  input: MergeCallerFactsInput,
): Promise<MergeCallerFactsResult> {
  let next = { ...ctx };
  let schedulingChanged = false;
  let intakeFieldsSaved: import("./intake/types").IntakeFieldKey[] = [];

  const intakeMerge = mergeUtteranceIntakeFactsIntoContext(next, input.utterance, input.turnId);
  next = intakeMerge.ctx;
  intakeFieldsSaved = intakeMerge.saved;

  if (input.interpretation.digression) {
    return { ctx: next, schedulingChanged: false, intakeFieldsSaved };
  }
  let workflow: VoiceV2BookingWorkflow = { ...workflowFromContext(next) };

  if (isActiveBookingGoal(input.interpretation.intent) || isActiveBookingGoal(dialogFromContext(next).activeGoal)) {
    workflow = { ...workflow, bookingIntentActive: true };
  }

  const strategy = next.capabilities?.bookingStrategy ?? "MICROSOFT_365";

  const schedulingPatch = extractSchedulingFromCallerSpeech({
    utterance: input.utterance,
    timezone: next.businessTimezone,
    now: input.now,
    turnId: input.turnId,
    entities: input.interpretation.entities,
  });

  if (schedulingPatch && (schedulingPatch.requestedDate || schedulingPatch.requestedDaypart || schedulingPatch.requestedTime)) {
    const prior = next.schedulingPreference;
    const mergedPref = mergeSchedulingPreferenceRecord(prior, schedulingPatch, {
      forceReplace: utteranceLooksLikeSchedulingCorrection(input.utterance),
    });
    const priorJson = JSON.stringify(prior ?? {});
    const nextJson = JSON.stringify(mergedPref);
    if (priorJson !== nextJson) {
      schedulingChanged = true;
      const hadOffer = Boolean(next.currentOfferSet?.offerSetId);
      next = { ...next, schedulingPreference: mergedPref };
      workflow = syncWorkflowRequestedDateFromScheduling(workflow, mergedPref);
      const correction = utteranceLooksLikeSchedulingCorrection(input.utterance);
      if (correction || hadOffer) {
        next = {
          ...next,
          currentOfferSet: undefined,
          bookingState:
            next.bookingState?.selectedSlotId
              ? { ...next.bookingState, selectedSlotId: undefined, status: "pending" }
              : next.bookingState,
        };
        workflow = {
          ...workflow,
          nextStage: deriveVoiceV2NextStage({
            workflow,
            readiness: getIntakeReadiness(next.intakeSchema, next.intakeState),
            hasActiveOfferSet: false,
            bookingStrategy: strategy,
            schedulingPreference: mergedPref,
            selectedSlotId: undefined,
          }),
        };
      }
    }
  }

  const readiness = getIntakeReadiness(next.intakeSchema, next.intakeState);
  const hasOffer =
    Boolean(next.currentOfferSet?.offerSetId) &&
    (next.currentOfferSet?.slotIds?.length ?? 0) > 0;
  workflow = {
    ...workflow,
    nextStage: deriveVoiceV2NextStage({
      workflow,
      readiness,
      hasActiveOfferSet: hasOffer,
      bookingStrategy: strategy,
      schedulingPreference: next.schedulingPreference,
      selectedSlotId: next.bookingState?.selectedSlotId,
    }),
  };

  next = mergeWorkflowIntoContext(next, workflow);

  const offerId = next.currentOfferSet?.offerSetId;
  if (offerId && input.utterance.trim()) {
    const loaded = await loadVoiceV2OfferSet(next.workspaceId, offerId).catch(() => null);
    if (loaded?.slots?.length) {
      const slotId = resolveSelectedSlotIdFromOffer(loaded.slots, input.utterance);
      if (slotId && next.bookingState?.selectedSlotId !== slotId) {
        next = {
          ...next,
          bookingState: { ...(next.bookingState ?? {}), selectedSlotId: slotId, status: "selected" },
        };
        next = rederiveWorkflowStageForContext(next);
      }
    }
  }

  return { ctx: next, schedulingChanged, intakeFieldsSaved };
}

export { rederiveWorkflowStageForContext } from "./workflow-rederive";
