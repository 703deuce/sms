import "server-only";

import { normalizeRequestedDate, workflowFromContext } from "../booking-workflow";
import { evaluateBookingIntakeGate } from "./booking-gate";
import { ensureVoiceV2CallContext, resolveSessionKey } from "./load-call-context";
import { speakForMissingBeforeBookingFields } from "./missing-field-speak";
import { getVoiceV2CallContext } from "./session-store";

export type FindAvailabilityPreflightResult =
  | { allowed: true }
  | { allowed: false; status: "MISSING_REQUIRED_FIELDS"; speak: string }
  | { allowed: false; status: "OFFER_ALREADY_ACTIVE"; speak: string };

export async function evaluateFindAvailabilityPreflight(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
  requestedDate?: unknown;
}): Promise<FindAvailabilityPreflightResult> {
  const gate = await evaluateBookingIntakeGate({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callControlId: input.callControlId,
    conversationId: input.conversationId,
    fromE164: input.fromE164,
  });
  if (!gate.allowed) {
    const sk = resolveSessionKey({
      callControlId: input.callControlId,
      conversationId: input.conversationId,
    });
    const ctx =
      (sk ? getVoiceV2CallContext(sk) : null) ||
      (await ensureVoiceV2CallContext({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callControlId: input.callControlId,
        conversationId: input.conversationId,
        fromE164: input.fromE164,
      }));
    const speak = ctx
      ? speakForMissingBeforeBookingFields(ctx.intakeSchema, gate.missing_fields)
      : "I still need a few details before I can check the calendar.";
    return { allowed: false, status: "MISSING_REQUIRED_FIELDS", speak };
  }

  const sk = resolveSessionKey({
    callControlId: input.callControlId,
    conversationId: input.conversationId,
  });
  const ctx =
    (sk ? getVoiceV2CallContext(sk) : null) ||
    (await ensureVoiceV2CallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: input.callControlId,
      conversationId: input.conversationId,
      fromE164: input.fromE164,
    }));
  if (!ctx) return { allowed: true };

  const offer = ctx.currentOfferSet;
  const hasOffer = Boolean(offer?.offerSetId) && (offer?.slotIds?.length ?? 0) > 0;
  if (!hasOffer) return { allowed: true };

  const requested = normalizeRequestedDate(input.requestedDate);
  const workflow = workflowFromContext(ctx);
  if (requested && workflow.requestedDate && requested === workflow.requestedDate) {
    return {
      allowed: false,
      status: "OFFER_ALREADY_ACTIVE",
      speak:
        "You already shared open times for that day. When the caller picks one — for example three PM — call voice_v2_book_offered_slot with the matching slot_id. Do not call find again or re-ask the day.",
    };
  }

  return { allowed: true };
}
