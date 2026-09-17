import "server-only";

import type { VoiceV2CallContext } from "./intake/types";
import type {
  InterpreterContext,
  InterpreterOfferSlotSummary,
  StableUtteranceRef,
} from "./caller-meaning";
import { dialogFromContext } from "./dialog-goal";
import { workflowFromContext } from "./booking-workflow";
import { effectiveRequestedDate } from "./scheduling-preference-state";
import { loadVoiceV2OfferSet } from "./offer-set-store";
import type { VoiceV2NextStage } from "./booking-workflow";

export async function buildInterpreterContext(input: {
  stable: StableUtteranceRef;
  fullConversationTranscript: string;
  callContext: VoiceV2CallContext;
  currentWorkflowStage: VoiceV2NextStage;
  callId?: string;
  now?: Date;
}): Promise<InterpreterContext> {
  const dialog = dialogFromContext(input.callContext);
  const workflow = workflowFromContext(input.callContext);
  const now = input.now ?? new Date();

  let offeredSlots: InterpreterOfferSlotSummary[] = [];
  const offerSetId = input.callContext.currentOfferSet?.offerSetId;
  if (offerSetId) {
    const loaded = await loadVoiceV2OfferSet(input.callContext.workspaceId, offerSetId).catch(
      () => null,
    );
    if (loaded?.slots?.length) {
      offeredSlots = loaded.slots.map((s, i) => ({
        slot_id: s.slot_id,
        label: s.label,
        spoken_label: s.spoken_label,
        sort_index: i + 1,
      }));
    }
  }

  const intakeSnapshot: Record<string, string> = {};
  for (const field of input.callContext.intakeSchema.fields) {
    const v = input.callContext.intakeState[field.key]?.value?.trim();
    if (v) intakeSnapshot[field.key] = v;
  }

  return {
    stable: input.stable,
    fullConversationTranscript: input.fullConversationTranscript.trim(),
    callContext: input.callContext,
    priorActiveGoal: dialog.activeGoal,
    activeGoal: dialog.activeGoal,
    currentWorkflowStage: input.currentWorkflowStage,
    businessTimezone: input.callContext.businessTimezone,
    currentDateTimeIso: now.toISOString(),
    schedulingPreference: input.callContext.schedulingPreference ?? null,
    effectiveRequestedDate: effectiveRequestedDate(input.callContext, workflow),
    currentOfferSet: offerSetId
      ? {
          offer_set_id: offerSetId,
          slot_ids: input.callContext.currentOfferSet?.slotIds ?? [],
          offered_slots: offeredSlots,
        }
      : null,
    acceptedIntakeSnapshot: intakeSnapshot,
    callId: input.callId,
  };
}
