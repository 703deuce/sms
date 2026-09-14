/**
 * MCTB AI Lead Recovery — Intent → Policy → Action runtime (booking is one action).
 */
import { getPrisma } from "@/lib/db";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { evaluateLeadRecoveryPolicy } from "@/lib/mctb/lead-recovery/policy-engine";
import { evaluateLeadRecoveryPolicyMulti, markIntentCompleted } from "@/lib/mctb/lead-recovery/intent-plan";
import { recordLeadRecoveryDomainEvent, actionToDomainEvent } from "@/lib/mctb/lead-recovery/domain-events";
import { executeLeadRecoveryActions } from "@/lib/mctb/lead-recovery/action-runtime";
import {
  appendConversationTurn,
  applyCollectedField,
  loadLeadRecoveryState,
  mergeIntentIntoState,
  saveLeadRecoveryState,
} from "@/lib/mctb/lead-recovery/state-store";
import { tryExtractFieldFromMessage } from "@/lib/mctb/lead-recovery/field-collection";
import type { LeadRecoveryInboundResult } from "@/lib/mctb/lead-recovery/types";
import { emitMctbHumanRequiredHandoff } from "@/lib/mctb/handoff/process-inbound-reply";
import {
  markPendingAction,
  registerInboundProviderMessage,
} from "@/lib/mctb/lead-recovery/conversation-guard";
import { applyWorkflowInvalidation } from "@/lib/mctb/lead-recovery/workflow-invalidation";
import { withLeadRecoveryCrossWorkerLock } from "@/lib/mctb/lead-recovery/cross-worker-lock";
import { buildMctbSemanticConversationContext } from "@/lib/mctb/semantic-conversation-context";
import type { LeadRecoveryCollectField, StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

function applyIntentExtractedFields(
  state: Awaited<ReturnType<typeof loadLeadRecoveryState>>,
  intent: StructuredLeadIntent,
) {
  let next = state;
  for (const [k, v] of Object.entries(intent.extracted_entities)) {
    if (v?.trim()) {
      next = applyCollectedField(next, k as LeadRecoveryCollectField, v.trim());
    }
  }
  return next;
}

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
  providerMessageId?: string | null;
}): Promise<LeadRecoveryInboundResult> {
  const config = await loadLeadRecoveryConfig(input.workspaceId);
  if (!config.enabled || config.policyHealth === "DISABLED") {
    return { handled: false, reason: "lead_recovery_disabled" };
  }
  if (!input.conversationId) {
    return { handled: false, reason: "no_conversation" };
  }

  const conversationId = input.conversationId;

  return withLeadRecoveryCrossWorkerLock(conversationId, async () =>
    handleMctbLeadRecoveryInboundSmsLocked({ ...input, conversationId, config }),
  );
}

async function handleMctbLeadRecoveryInboundSmsLocked(input: {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  customerEmail?: string | null;
  body: string;
  timezone?: string;
  missedCallEventId?: string | null;
  providerMessageId?: string | null;
  config: Awaited<ReturnType<typeof loadLeadRecoveryConfig>>;
}): Promise<LeadRecoveryInboundResult> {
  const config = input.config;
  const conversationId = input.conversationId;
  const session = await getMctbAiBookingSessionStore().get(conversationId);
  const awaitingSlot = session?.stage === "AWAITING_SLOT_SELECTION";

  let state = await loadLeadRecoveryState({
    workspaceId: input.workspaceId,
    conversationId,
  });

  const inbound = registerInboundProviderMessage(state, input.providerMessageId);
  state = inbound.state;
  if (inbound.duplicate) {
    return { handled: true, reply: "", action: "duplicate_inbound_ignored" };
  }

  state = appendConversationTurn(state, { role: "customer", text: input.body });

  const bookingWorkflowActive =
    awaitingSlot ||
    state.phase === "AWAITING_SLOT_SELECTION" ||
    state.activeSpecialist === "SCHEDULING";

  if (bookingWorkflowActive) {
    state = { ...state, phase: "AWAITING_SLOT_SELECTION", activeSpecialist: "SCHEDULING" };
  }

  if (state.phase === "COLLECT" && state.missingFields.length > 0) {
    const field = state.missingFields[0];
    const extracted = tryExtractFieldFromMessage(field, input.body);
    if (extracted) {
      state = applyCollectedField(state, field, extracted);
    }
  }

  const semanticCtx = await buildMctbSemanticConversationContext({
    workspaceId: input.workspaceId,
    conversationId,
    latestCustomerMessage: input.body,
  });

  if (bookingWorkflowActive) {
    const workflowIntent = await runLeadRecoveryIntentAgent({
      message: input.body,
      conversationContext: semanticCtx,
    });

    if (
      workflowIntent.primary_intent === "OPT_OUT" ||
      workflowIntent.primary_intent === "WRONG_NUMBER"
    ) {
      state = mergeIntentIntoState(state, workflowIntent);
      const policy = evaluateLeadRecoveryPolicy({
        workspace: config,
        intent: workflowIntent,
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
        intent: workflowIntent,
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
      await saveLeadRecoveryState({ ...state, phase: "COMPLETE", lastCustomerMessage: input.body });
      return {
        handled: true,
        reply: runtime.reply,
        action: runtime.action,
        policy,
        intent: workflowIntent,
      };
    }

    state = applyWorkflowInvalidation(state, workflowIntent);
    state = mergeIntentIntoState(state, workflowIntent);
    if (
      awaitingSlot &&
      (session?.offeredSlots?.length ?? 0) > 0 &&
      state.pendingAction?.action !== "AI_BOOK"
    ) {
      state = markPendingAction(state, {
        action: "AI_BOOK",
        epoch: state.stateVersion ?? 0,
      });
    }
    const writeEpoch =
      state.pendingAction?.action === "AI_BOOK"
        ? state.pendingAction.epoch
        : state.stateVersion ?? 0;
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
      writeEpoch,
      forceSchedulingRoute: false,
    });
    if (booking.handled) {
      state = {
        ...state,
        activeSpecialist: "SCHEDULING",
        phase: "AWAITING_SLOT_SELECTION",
        lastCustomerMessage: input.body,
        lastBusinessMessage: booking.reply,
      };
      if (booking.reply?.trim()) {
        state = appendConversationTurn(state, { role: "business", text: booking.reply });
      }
      await saveLeadRecoveryState(state);
      return {
        handled: true,
        reply: booking.reply,
        action: booking.action,
        intent: workflowIntent,
      };
    }
    state = { ...state, lastCustomerMessage: input.body };
    await saveLeadRecoveryState(state);
    return {
      handled: true,
      reply: booking.reply || config.fallbackPolicy.customerMessage || "What time works best?",
      action: booking.action || "ai_booking_clarify",
      intent: workflowIntent,
    };
  }

  const intent = await runLeadRecoveryIntentAgent({
    message: input.body,
    conversationContext: semanticCtx,
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

  state = applyWorkflowInvalidation(state, intent);

  state = mergeIntentIntoState(state, intent);
  state = applyIntentExtractedFields(state, intent);
  if (intent.confidence < 0.45) {
    state = { ...state, clarificationAttempts: state.clarificationAttempts + 1 };
  }

  const multi = evaluateLeadRecoveryPolicyMulti({
    workspace: config,
    intent,
    collectedData: state.collectedFields,
    conversationState: state,
  });
  const policy = multi.primary;

  state = {
    ...state,
    intentPlan: multi.executionPlan,
    missingFields: policy.missingFields,
    phase: policy.phase === "COLLECT" ? "COLLECT" : policy.phase === "EXECUTE" ? "EXECUTE" : state.phase,
  };

  await recordLeadRecoveryDomainEvent({
    workspaceId: input.workspaceId,
    conversationId,
    contactId: input.contactId,
    kind: "INTENT_IDENTIFIED",
    idempotencyKey: `intent:${conversationId}:${input.body.slice(0, 32)}`,
    payload: {
      primary: intent.primary_intent,
      secondary: intent.secondary_intents,
      confidence: intent.confidence,
    },
  }).catch(() => undefined);

  await recordLeadRecoveryDomainEvent({
    workspaceId: input.workspaceId,
    conversationId,
    contactId: input.contactId,
    kind: "POLICY_MATCHED",
    idempotencyKey: `policy:${conversationId}:${policy.matchedPolicyId}:${input.body.slice(0, 16)}`,
    payload: { matchedPolicyId: policy.matchedPolicyId, intent: policy.intent },
  }).catch(() => undefined);

  let replyPrefix = "";
  const pricingSecondary = multi.secondaryPlans.find(
    (p) => p.intent === "PRICING_QUESTION" || p.intent === "ESTIMATE_REQUEST",
  );
  if (
    pricingSecondary &&
    policy.intent !== pricingSecondary.intent &&
    pricingSecondary.plan.responseConstraints.customerMessageTemplate
  ) {
    replyPrefix = `${pricingSecondary.plan.responseConstraints.customerMessageTemplate} `;
  }

  const writeEpoch = state.stateVersion ?? 0;
  const consequential = policy.nextActions.find((a) =>
    [
      "SEND_TEXT_TO_PAY",
      "AI_BOOK",
      "SEND_BOOKING_LINK",
      "CREATE_CALLBACK_REQUEST",
      "SEND_OWNER_SMS",
    ].includes(a.action),
  );
  if (consequential && policy.phase === "EXECUTE") {
    state = markPendingAction(state, {
      action: consequential.action,
      epoch: writeEpoch,
    });
    await saveLeadRecoveryState(state);
  }

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
    writeEpoch,
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
      writeEpoch,
      forceSchedulingRoute: true,
    });
    if (booking.handled) {
      await saveLeadRecoveryState({
        ...state,
        activeSpecialist: "SCHEDULING",
        phase: "AWAITING_SLOT_SELECTION",
      });
      const combinedReply = replyPrefix ? `${replyPrefix}${booking.reply}` : booking.reply;
      state = {
        ...state,
        intentPlan: markIntentCompleted(state.intentPlan, "BOOKING_REQUEST"),
      };
      state = {
        ...state,
        lastCustomerMessage: input.body,
        lastBusinessMessage: combinedReply,
      };
      state = appendConversationTurn(state, { role: "business", text: combinedReply });
      await saveLeadRecoveryState(state);
      return {
        handled: true,
        reply: combinedReply,
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
    state.clarificationAttempts > 2 &&
    policy.phase !== "CLARIFY" &&
    !intent.booking_requested &&
    !intent.requested_time
  ) {
    const safeReply =
      config.fallbackPolicy.customerMessage ||
      "Thanks — someone from our team will follow up shortly.";
    state = { ...state, phase: "COMPLETE", lastCustomerMessage: input.body };
    await saveLeadRecoveryState(state);
    await emitMctbHumanRequiredHandoff({
      workspaceId: input.workspaceId,
      fromE164: input.customerPhone,
      body: input.body,
      conversationId,
      missedCallEventId: input.missedCallEventId,
    }).catch(() => undefined);
    return {
      handled: true,
      reply: safeReply,
      action: "lead_recovery_safe_fallback",
      policy,
      intent,
    };
  }

  const domainKind = actionToDomainEvent(runtime.action);
  if (domainKind) {
    await recordLeadRecoveryDomainEvent({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      kind: domainKind,
      idempotencyKey: `${domainKind}:${conversationId}:${runtime.action}`,
      payload: { action: runtime.action },
    }).catch(() => undefined);
  }

  if (policy.phase === "EXECUTE" && policy.intent) {
    state = {
      ...state,
      intentPlan: markIntentCompleted(state.intentPlan, policy.intent),
    };
  }

  const finalReply = replyPrefix ? `${replyPrefix}${runtime.reply}` : runtime.reply;
  state = {
    ...state,
    lastCustomerMessage: input.body,
    lastBusinessMessage: finalReply.trim() ? finalReply : state.lastBusinessMessage,
  };
  if (finalReply.trim()) {
    state = appendConversationTurn(state, { role: "business", text: finalReply });
  }
  await saveLeadRecoveryState(state);

  return {
    handled: true,
    reply: finalReply,
    action: runtime.action,
    policy,
    intent,
  };
}
