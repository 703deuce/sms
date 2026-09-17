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
  normalizeDaypart,
  syncWorkflowRequestedDateFromScheduling,
  utteranceLooksLikeSchedulingCorrection,
  type VoiceV2SchedulingPreference,
} from "./scheduling-preference-state";
import { mergeUtteranceIntakeFactsIntoContext } from "./intake/apply-intake-facts";
import { resolveSelectedSlotIdFromOffer } from "./resolve-slot-from-offer";
import { resolveSlotIdFromOfferReference } from "./resolve-slot-from-offer-ordinal";
import { loadVoiceV2OfferSet } from "./offer-set-store";
import type { CallerMeaningFacts } from "./caller-meaning";
import { rederiveWorkflowStageForContext } from "./workflow-rederive";

export type MergeCallerFactsInput = {
  utterance: string;
  interpretation: VoiceCallerIntentInterpretation;
  evidence?: string;
  now?: Date;
  turnId?: string;
  meaningFacts?: CallerMeaningFacts;
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

  const meaningScheduling: Partial<VoiceV2SchedulingPreference> | null =
    input.meaningFacts?.requested_date ||
    input.meaningFacts?.requested_daypart ||
    input.meaningFacts?.requested_time
      ? {
          ...(input.meaningFacts.requested_date
            ? { requestedDate: input.meaningFacts.requested_date }
            : {}),
          ...(input.meaningFacts.requested_daypart
            ? { requestedDaypart: normalizeDaypart(input.meaningFacts.requested_daypart) }
            : {}),
          ...(input.meaningFacts.requested_time
            ? { requestedTime: input.meaningFacts.requested_time }
            : {}),
          source: "caller",
          turnId: input.turnId,
          updatedAt: new Date().toISOString(),
          evidence: input.utterance.slice(0, 240),
        }
      : null;

  const schedulingToApply =
    meaningScheduling?.requestedDate ||
    meaningScheduling?.requestedDaypart ||
    meaningScheduling?.requestedTime
      ? { ...(schedulingPatch ?? {}), ...meaningScheduling }
      : schedulingPatch;

  if (
    schedulingToApply &&
    (schedulingToApply.requestedDate ||
      schedulingToApply.requestedDaypart ||
      schedulingToApply.requestedTime)
  ) {
    const prior = next.schedulingPreference;
    const mergedPref = mergeSchedulingPreferenceRecord(prior, schedulingToApply, {
      forceReplace:
        utteranceLooksLikeSchedulingCorrection(input.utterance) ||
        Boolean(input.meaningFacts?.requested_date),
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
  if (offerId) {
    const loaded = await loadVoiceV2OfferSet(next.workspaceId, offerId).catch(() => null);
    if (loaded?.slots?.length) {
      let slotId: string | null = null;
      const mf = input.meaningFacts;
      if (mf?.selected_slot_id && loaded.slots.some((s) => s.slot_id === mf.selected_slot_id)) {
        slotId = mf.selected_slot_id;
      } else if (mf?.selected_slot_ordinal && mf.selected_slot_ordinal > 0) {
        slotId = loaded.slots[mf.selected_slot_ordinal - 1]?.slot_id ?? null;
      } else if (mf?.selected_slot_spoken_label) {
        slotId =
          resolveSlotIdFromOfferReference(loaded.slots, mf.selected_slot_spoken_label) ??
          resolveSelectedSlotIdFromOffer(loaded.slots, mf.selected_slot_spoken_label);
      } else if (input.utterance.trim()) {
        slotId =
          resolveSlotIdFromOfferReference(loaded.slots, input.utterance) ??
          resolveSelectedSlotIdFromOffer(loaded.slots, input.utterance);
      }
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
