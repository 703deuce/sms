/**
 * MCTB AI Lead Recovery — Intent → Policy → Action runtime (booking is one action).
 */
import { getPrisma } from "@/lib/db";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { evaluateLeadRecoveryPolicy } from "@/lib/mctb/lead-recovery/policy-engine";
import { executeLeadRecoveryActions } from "@/lib/mctb/lead-recovery/action-runtime";
import {
  applyCollectedField,
  loadLeadRecoveryState,
  mergeIntentIntoState,
  saveLeadRecoveryState,
} from "@/lib/mctb/lead-recovery/state-store";
import { tryExtractFieldFromMessage } from "@/lib/mctb/lead-recovery/field-collection";
import type { LeadRecoveryInboundResult } from "@/lib/mctb/lead-recovery/types";
import { emitMctbHumanRequiredHandoff } from "@/lib/mctb/handoff/process-inbound-reply";

export async function handleMctbLeadRecoveryInboundSms(input: {
  workspaceId: string;
  conversationId?: string | null;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  customerEmail?: string | null;
  body: string;
  timezone?: string;
  missedCallEventId?: string | null;
}): Promise<LeadRecoveryInboundResult> {
  const config = await loadLeadRecoveryConfig(input.workspaceId);
  if (!config.enabled || config.policyHealth === "DISABLED") {
    return { handled: false, reason: "lead_recovery_disabled" };
  }
  if (!input.conversationId) {
    return { handled: false, reason: "no_conversation" };
  }

  const conversationId = input.conversationId;
  const session = await getMctbAiBookingSessionStore().get(conversationId);
  const awaitingSlot = session?.stage === "AWAITING_SLOT_SELECTION";

  let state = await loadLeadRecoveryState({
    workspaceId: input.workspaceId,
    conversationId,
  });

  if (awaitingSlot) {
    state = { ...state, phase: "AWAITING_SLOT_SELECTION", activeSpecialist: "SCHEDULING" };
  }

  if (state.phase === "COLLECT" && state.missingFields.length > 0) {
    const field = state.missingFields[0];
    const extracted = tryExtractFieldFromMessage(field, input.body);
    if (extracted) {
      state = applyCollectedField(state, field, extracted);
    }
  }

  const intent =
    awaitingSlot
      ? state.lastIntent ||
        (await runLeadRecoveryIntentAgent({
          message: input.body,
          sessionPhase: state.phase,
        }))
      : await runLeadRecoveryIntentAgent({
          message: input.body,
          sessionPhase: state.phase,
        });

  if (intent.primary_intent === "OPT_OUT" || intent.primary_intent === "WRONG_NUMBER") {
    state = mergeIntentIntoState(state, intent);
    const policy = evaluateLeadRecoveryPolicy({
      workspace: config,
      intent,
      collectedData: state.collectedFields,
      conversationState: state,
    });
    const runtime = await executeLeadRecoveryActions({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      customerPhone: input.customerPhone,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      body: input.body,
      timezone: input.timezone,
      config,
      intent,
      policy,
      collectedFields: state.collectedFields,
    });
    if (runtime.suppressContact) {
      const prisma = getPrisma();
      await prisma.suppression.upsert({
        where: { suppressionKey: `${input.workspaceId}:p:${input.customerPhone}` },
        create: {
          workspaceId: input.workspaceId,
          phone: input.customerPhone,
          suppressionKey: `${input.workspaceId}:p:${input.customerPhone}`,
          reason: "sms_stop",
          source: "lead_recovery",
        },
        update: { reason: "sms_stop", source: "lead_recovery" },
      });
    }
    await saveLeadRecoveryState({ ...state, phase: "COMPLETE" });
    return {
      handled: true,
      reply: runtime.reply,
      action: runtime.action,
      policy,
      intent,
    };
  }

  state = mergeIntentIntoState(state, intent);
  if (intent.confidence < 0.45) {
    state = { ...state, clarificationAttempts: state.clarificationAttempts + 1 };
  }

  const policy = evaluateLeadRecoveryPolicy({
    workspace: config,
    intent,
    collectedData: state.collectedFields,
    conversationState: state,
  });

  state = {
    ...state,
    missingFields: policy.missingFields,
    phase: policy.phase === "COLLECT" ? "COLLECT" : policy.phase === "EXECUTE" ? "EXECUTE" : state.phase,
  };

  const runtime = await executeLeadRecoveryActions({
    workspaceId: input.workspaceId,
    conversationId,
    contactId: input.contactId,
    customerPhone: input.customerPhone,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    body: input.body,
    timezone: input.timezone,
    config,
    intent,
    policy,
    collectedFields: state.collectedFields,
  });

  if (runtime.delegateAiBooking) {
    const { handleMctbAiBookingInboundSms } = await import(
      "@/lib/mctb/ai-booking/conversation-runtime"
    );
    const booking = await handleMctbAiBookingInboundSms({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      customerPhone: input.customerPhone,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      body: input.body,
      timezone: input.timezone,
    });
    if (booking.handled) {
      await saveLeadRecoveryState({
        ...state,
        activeSpecialist: "SCHEDULING",
        phase: "AWAITING_SLOT_SELECTION",
      });
      return {
        handled: true,
        reply: booking.reply,
        action: booking.action,
        policy,
        intent,
      };
    }
  }

  if (runtime.escalateHuman) {
    await emitMctbHumanRequiredHandoff({
      workspaceId: input.workspaceId,
      fromE164: input.customerPhone,
      body: input.body,
      conversationId,
      missedCallEventId: input.missedCallEventId,
    }).catch(() => undefined);
  }

  if (
    intent.primary_intent === "UNKNOWN" &&
    intent.confidence < 0.4 &&
    state.clarificationAttempts > 1
  ) {
    return { handled: false, reason: "defer_to_john" };
  }

  await saveLeadRecoveryState(state);

  return {
    handled: true,
    reply: runtime.reply,
    action: runtime.action,
    policy,
    intent,
  };
}
