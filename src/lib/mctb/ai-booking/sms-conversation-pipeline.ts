/**
 * Primary MCTB SMS conversation path — same multi-agent front as AI Booking (router → specialist),
 * with configurable fulfillment (booking link vs live calendar orchestrator).
 */
import { resolveCanonicalBookingTimezone } from "@/lib/mctb/ai-booking/booking-timezone";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { sendMctbBookingLinkSmsReply } from "@/lib/mctb/ai-booking/booking-link-sms";
import { calendarFulfillmentEnabled } from "@/lib/mctb/ai-booking/fulfillment-mode";
import { handleMctbAiBookingInboundSms } from "@/lib/mctb/ai-booking/conversation-runtime";
import type { MctbAiBookingInboundResult } from "@/lib/mctb/ai-booking/conversation-runtime-types";
import {
  runIntentRouterAgent,
  shouldRouteToScheduling,
} from "@/lib/mctb/ai-booking/agents/router";
import { runSchedulingSpecialistAgent } from "@/lib/mctb/ai-booking/agents/scheduling-specialist";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { generateApprovedInformationSmsReply } from "@/lib/mctb/lead-recovery/approved-information-reply";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { executeLeadRecoveryActions } from "@/lib/mctb/lead-recovery/action-runtime";
import { evaluateLeadRecoveryPolicy } from "@/lib/mctb/lead-recovery/policy-engine";
import { loadLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";
import { finalizeMctbOutboundSms } from "@/lib/mctb/sms-channel";

export type MctbSmsConversationPipelineInput = {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  customerEmail?: string | null;
  body: string;
  timezone?: string;
  recoverySmsCallerE164?: string;
  recoverySmsBusinessE164?: string;
};

async function buildSemanticContext(input: MctbSmsConversationPipelineInput) {
  const { buildMctbSemanticConversationContext, bookingRouterUserPayload } = await import(
    "@/lib/mctb/semantic-conversation-context"
  );
  const semanticCtx = await buildMctbSemanticConversationContext({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    latestCustomerMessage: input.body,
    recoverySmsCallerE164: input.recoverySmsCallerE164,
    recoverySmsBusinessE164: input.recoverySmsBusinessE164,
  });
  const routerPayload = bookingRouterUserPayload(semanticCtx);
  return { semanticCtx, routerPayload };
}

async function handleComplianceIntents(input: {
  pipeline: MctbSmsConversationPipelineInput;
  intent: StructuredLeadIntent;
  lrConfig: Awaited<ReturnType<typeof loadLeadRecoveryConfig>>;
}): Promise<MctbAiBookingInboundResult | null> {
  if (input.intent.primary_intent !== "OPT_OUT" && input.intent.primary_intent !== "WRONG_NUMBER") {
    return null;
  }
  const conversationState = await loadLeadRecoveryState({
    workspaceId: input.pipeline.workspaceId,
    conversationId: input.pipeline.conversationId,
  });
  const policy = evaluateLeadRecoveryPolicy({
    workspace: input.lrConfig,
    intent: input.intent,
    collectedData: conversationState.collectedFields,
    conversationState,
  });
  const runtime = await executeLeadRecoveryActions({
    workspaceId: input.pipeline.workspaceId,
    conversationId: input.pipeline.conversationId,
    contactId: input.pipeline.contactId,
    customerPhone: input.pipeline.customerPhone,
    customerName: input.pipeline.customerName,
    customerEmail: input.pipeline.customerEmail,
    body: input.pipeline.body,
    timezone: input.pipeline.timezone,
    config: input.lrConfig,
    intent: input.intent,
    policy,
    collectedFields: {},
  });
  return { handled: true, reply: runtime.reply, action: runtime.action };
}

async function handleGeneralConversation(input: {
  pipeline: MctbSmsConversationPipelineInput;
  lrConfig: Awaited<ReturnType<typeof loadLeadRecoveryConfig>>;
  structuredIntent: StructuredLeadIntent;
}): Promise<MctbAiBookingInboundResult> {
  const faqIntents = new Set([
    "BUSINESS_FAQ",
    "BUSINESS_HOURS",
    "BUSINESS_LOCATION",
    "SERVICE_AREA_CHECK",
    "PRICING_QUESTION",
  ]);
  let intentForAnswer = input.structuredIntent.primary_intent;
  if (!faqIntents.has(intentForAnswer)) {
    intentForAnswer = "BUSINESS_FAQ";
  }
  const intentForReply: StructuredLeadIntent = {
    ...input.structuredIntent,
    primary_intent: intentForAnswer,
  };
  const faq = await generateApprovedInformationSmsReply({
    workspaceId: input.pipeline.workspaceId,
    customerMessage: input.pipeline.body,
    structuredIntent: intentForReply,
    config: input.lrConfig,
  });
  let reply = faq.reply;
  if (!faq.grounded && input.structuredIntent.needs_clarification) {
    reply =
      "Happy to help — what would you like to know about our business, or were you hoping to schedule something?";
  }
  return {
    handled: true,
    reply: finalizeMctbOutboundSms(reply),
    action: faq.grounded ? "approved_info" : "conversation_clarify",
  };
}

/**
 * Multi-agent SMS pipeline (router-first). Used as primary handler when Lead Recovery is on
 * and `smsPipelinePrimary` is true (default).
 */
export async function handleMctbSmsConversationPipeline(
  input: MctbSmsConversationPipelineInput,
): Promise<MctbAiBookingInboundResult> {
  const bookingConfig = await loadMctbAiBookingConfig(input.workspaceId);
  if (!bookingConfig.smsPipelinePrimary) {
    return { handled: false };
  }

  const lrConfig = await loadLeadRecoveryConfig(input.workspaceId);
  const { semanticCtx, routerPayload } = await buildSemanticContext(input);

  const classified = await runLeadRecoveryIntentAgent({
    message: input.body,
    conversationContext: semanticCtx,
  });
  const compliance = await handleComplianceIntents({
    pipeline: input,
    intent: classified,
    lrConfig,
  });
  if (compliance) return compliance;

  const session = await getMctbAiBookingSessionStore().get(input.conversationId);
  const offeredSlots = session?.offeredSlots ?? [];
  const sessionActive = offeredSlots.length > 0;
  const awaitingSelection = session?.stage === "AWAITING_SLOT_SELECTION" || sessionActive;

  const route = await runIntentRouterAgent({
    message: input.body,
    conversation: routerPayload.conversation as Array<{ role: "customer" | "business"; text: string }>,
    aiBookingSessionActive: sessionActive,
    sessionStage: session?.stage,
  });

  const scheduling =
    shouldRouteToScheduling(route) || awaitingSelection || route.subintent === "ASK_BOOKING_LINK";

  if (scheduling) {
    if (
      calendarFulfillmentEnabled(bookingConfig) &&
      bookingConfig.enabled &&
      !bookingConfig.upgradeRequired
    ) {
      return handleMctbAiBookingInboundSms({
        ...input,
        forceSchedulingRoute: awaitingSelection ? false : shouldRouteToScheduling(route),
      });
    }

    if (route.subintent === "ASK_BOOKING_LINK" || !awaitingSelection) {
      return sendMctbBookingLinkSmsReply({
        workspaceId: input.workspaceId,
        customerMessage: input.body,
      });
    }

    const bookingTimezone = await resolveCanonicalBookingTimezone(input.workspaceId);
    const { schedulingSpecialistContextExtras } = await import(
      "@/lib/mctb/semantic-conversation-context"
    );
    const extras = await schedulingSpecialistContextExtras({
      workspaceId: input.workspaceId,
      timezone: bookingTimezone,
    });
    const specialist = await runSchedulingSpecialistAgent({
      message: input.body,
      timezone: bookingTimezone,
      nowIso: extras.nowIso,
      offeredSlots,
      aiBookingSessionActive: sessionActive,
      sessionStage: session?.stage,
      session,
      bookingConfig: extras.bookingConfig,
      semanticContext: semanticCtx,
      bookingAuthorized: false,
    });
    if (specialist.needs_clarification && specialist.clarification_text?.trim()) {
      return {
        handled: true,
        reply: finalizeMctbOutboundSms(specialist.clarification_text),
        action: "ai_booking_clarify",
      };
    }
    return sendMctbBookingLinkSmsReply({
      workspaceId: input.workspaceId,
      customerMessage: input.body,
      schedulingNote: specialist.clarification_text,
    });
  }

  if (route.intent === "CALLBACK_REQUEST" || classified.callback_requested) {
    return {
      handled: true,
      reply: finalizeMctbOutboundSms(
        "Got it — we'll call you back as soon as we can. What's the best number if this isn't it?",
      ),
      action: "callback_ack",
    };
  }

  if (route.intent === "HUMAN_HANDOFF" || classified.human_requested) {
    return {
      handled: true,
      reply: finalizeMctbOutboundSms(
        "I'll have someone from our team follow up with you shortly.",
      ),
      action: "human_handoff_ack",
    };
  }

  if (route.intent === "PAYMENT") {
    return {
      handled: true,
      reply: finalizeMctbOutboundSms(
        "For payment questions, our team will text or email you a secure link if needed.",
      ),
      action: "payment_redirect",
    };
  }

  return handleGeneralConversation({
    pipeline: input,
    lrConfig,
    structuredIntent: classified,
  });
}
