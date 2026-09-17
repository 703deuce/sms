import "server-only";

import {
  buildWorkflowToolPayload,
  VOICE_V2_FORBIDDEN_WHEN_BOOKING_CONTINUE,
  deriveVoiceV2NextStage,
  type VoiceV2NextStage,
  workflowFromContextWithDialog,
} from "./booking-workflow";
import type { VoiceV2BookingStrategy } from "./booking-strategy";
import type { VoiceV2CallContext } from "./intake/types";
import { deriveForbiddenToolActions, resolveRequiredActionForContext } from "./live-tool-registry";
import { filterAllowedActionsForDialog } from "./dialog-goal";
import { getIntakeReadiness } from "./intake/readiness";

export type VoiceV2ControlPlaneEnvelope = Record<string, unknown> & {
  voice_v2_next_stage: VoiceV2NextStage;
  allowed_next_actions: string[];
  forbidden_actions: string[];
  required_action?: string | null;
};

export function buildVoiceV2ControlPlaneEnvelope(
  ctx: VoiceV2CallContext,
  voiceV2PstnLiveBooking: boolean,
  bookingStrategy?: VoiceV2BookingStrategy,
): VoiceV2ControlPlaneEnvelope {
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const hasOffer =
    Boolean(ctx.currentOfferSet?.offerSetId) && (ctx.currentOfferSet?.slotIds?.length ?? 0) > 0;
  const workflow = workflowFromContextWithDialog(ctx);
  const strategy =
    bookingStrategy ??
    ctx.capabilities?.bookingStrategy ??
    (voiceV2PstnLiveBooking ? "MICROSOFT_365" : "NONE");
  workflow.nextStage = deriveVoiceV2NextStage({
    workflow,
    readiness,
    hasActiveOfferSet: hasOffer,
    bookingStrategy: strategy,
    schedulingPreference: ctx.schedulingPreference,
  });

  const base = buildWorkflowToolPayload({
    voiceV2PstnLiveBooking,
    bookingStrategy: strategy,
    workflow,
    readiness,
    hasActiveOfferSet: hasOffer,
    ctx,
  });
  const stage = (base.voice_v2_next_stage as VoiceV2NextStage) || "COLLECT_REQUIRED_INTAKE";
  const allowed = filterAllowedActionsForDialog(
    ctx,
    (base.allowed_next_actions as string[]) || [],
  );
  const forbidden = new Set<string>(deriveForbiddenToolActions(allowed));
  for (const f of VOICE_V2_FORBIDDEN_WHEN_BOOKING_CONTINUE) {
    forbidden.add(f);
  }
  if (base.forbidden_actions) {
    for (const f of base.forbidden_actions as string[]) forbidden.add(f);
  }

  const required =
    resolveRequiredActionForContext(ctx, stage, {
      voiceV2PstnLiveBooking,
      hasActiveOfferSet: hasOffer,
    }) ?? (base.required_action as string | null) ?? null;

  const envelope: VoiceV2ControlPlaneEnvelope = {
    ...base,
    voice_v2_next_stage: stage,
    allowed_next_actions: allowed,
    forbidden_actions: [...forbidden],
    required_action: required,
    intake_readiness: {
      missing_before_booking: readiness.missingBeforeBooking,
      missing_for_record: readiness.missingForRecord,
    },
    known_selected_slot_id: ctx.bookingState?.selectedSlotId ?? null,
    workflow_requested_date: workflow.requestedDate,
  };

  return envelope;
}
