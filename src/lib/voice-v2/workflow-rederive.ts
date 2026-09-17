import type { VoiceV2CallContext } from "./intake/types";
import {
  deriveVoiceV2NextStage,
  mergeWorkflowIntoContext,
  workflowFromContext,
  type VoiceV2BookingWorkflow,
} from "./booking-workflow";
import { getIntakeReadiness } from "./intake/readiness";
import { syncWorkflowRequestedDateFromScheduling } from "./scheduling-preference-state";

/** Re-derive workflow stage after any context mutation (intake save, FIND, fact merge, etc.). */
export function rederiveWorkflowStageForContext(ctx: VoiceV2CallContext): VoiceV2CallContext {
  let workflow: VoiceV2BookingWorkflow = syncWorkflowRequestedDateFromScheduling(
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
