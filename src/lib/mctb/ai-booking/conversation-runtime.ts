/**
 * MCTB inbound SMS — AI Booking production runtime (multi-agent + deterministic orchestrator).
 */
import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { orchestrateMctbAiBooking } from "@/lib/mctb/ai-booking/orchestrator";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { recordMctbAiBookingFallbackActivity } from "@/lib/mctb/ai-booking/activity";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import {
  runIntentRouterAgent,
  shouldRouteToScheduling,
} from "@/lib/mctb/ai-booking/agents/router";
import { runSchedulingSpecialistAgent } from "@/lib/mctb/ai-booking/agents/scheduling-specialist";
import { mapSpecialistToOrchestratorInput } from "@/lib/mctb/ai-booking/agents/map-to-orchestrator";
import { handleMctbAiBookingOrchestratorResult } from "@/lib/mctb/ai-booking/handle-orchestrator-result";
import { tryBookFromOfferedSlots } from "@/lib/mctb/ai-booking/book-offered-slot";
import { finalizeMctbOutboundSms } from "@/lib/mctb/sms-channel";

import type { MctbAiBookingInboundResult } from "@/lib/mctb/ai-booking/conversation-runtime-types";

export type { MctbAiBookingInboundResult };

export async function handleMctbAiBookingInboundSms(input: {
  workspaceId: string;
  conversationId?: string | null;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  customerEmail?: string | null;
  body: string;
  timezone?: string;
  writeEpoch?: number;
  /** Set when Lead Recovery policy already armed AI_BOOK — skip redundant router gate. */
  forceSchedulingRoute?: boolean;
}): Promise<MctbAiBookingInboundResult> {
  const config = await loadMctbAiBookingConfig(input.workspaceId);
  if (!config.enabled || config.upgradeRequired) {
    return { handled: false };
  }

  const conversationId = input.conversationId;
  if (!conversationId) {
    return { handled: false };
  }

  const session = await getMctbAiBookingSessionStore().get(conversationId);
  const offeredSlots = session?.offeredSlots ?? [];
  const sessionActive = offeredSlots.length > 0;
  const awaitingSelection = session?.stage === "AWAITING_SLOT_SELECTION" || sessionActive;

  const tz = input.timezone || config.timezone || "America/New_York";

  const route = input.forceSchedulingRoute
    ? {
        intent: "SCHEDULING" as const,
        confidence: 1,
        subintent: "CHECK_AVAILABILITY" as const,
        needs_clarification: false,
      }
    : await (async () => {
        const { buildMctbSemanticConversationContext, bookingRouterUserPayload } = await import(
          "@/lib/mctb/semantic-conversation-context"
        );
        const ctx = await buildMctbSemanticConversationContext({
          workspaceId: input.workspaceId,
          conversationId,
          latestCustomerMessage: input.body,
        });
        const routerPayload = bookingRouterUserPayload(ctx);
        return runIntentRouterAgent({
          message: input.body,
          conversation: routerPayload.conversation as Array<{ role: "customer" | "business"; text: string }>,
          aiBookingSessionActive: sessionActive,
          sessionStage: session?.stage,
        });
      })();

  if (!shouldRouteToScheduling(route) && !awaitingSelection) {
    return { handled: false };
  }

  if (route.subintent === "ASK_BOOKING_LINK") {
    const url = await resolveFallbackBookingUrl(input.workspaceId, config);
    const reply = url
      ? `You can pick a time here: ${url}`
      : "Please ask us for our booking link — we’ll send it shortly.";
    return { handled: true, reply, action: "ai_booking" };
  }

  const readiness = await evaluateMctbAiBookingReadiness(input.workspaceId);
  if (!readiness.ready) {
    const url = readiness.fallbackUrl;
    await recordMctbAiBookingFallbackActivity({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      reason: readiness.reason || "not_ready",
    });
    logMctbAiBookingEvent("fallback_used", { conversationId, reason: readiness.reason });
    const reply = url
      ? `I'm unable to check live availability right now. You can choose a time here: ${url}`
      : "I'm unable to check live availability right now. Please reply with another time or call us back.";
    return { handled: true, reply, action: "ai_booking_fallback" };
  }

  const { buildMctbSemanticConversationContext, schedulingSpecialistContextExtras } = await import(
    "@/lib/mctb/semantic-conversation-context"
  );
  const extras = await schedulingSpecialistContextExtras({
    workspaceId: input.workspaceId,
    timezone: tz,
  });

  const orchestrateBase = {
    workspaceId: input.workspaceId,
    conversationId,
    contactId: input.contactId,
    customerName: input.customerName || "Guest",
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    timezone: tz,
    writeEpoch: input.writeEpoch,
  };

  if (offeredSlots.length > 0) {
    const direct = await tryBookFromOfferedSlots({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      customerName: orchestrateBase.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      utterance: input.body,
      writeEpoch: input.writeEpoch,
    });
    if (direct.status === "needs_clarification") {
      return {
        handled: true,
        reply: finalizeMctbOutboundSms(direct.messageHint),
        action: "ai_booking_clarify",
      };
    }
    if (direct.status === "booked") {
      return handleMctbAiBookingOrchestratorResult({
        workspaceId: input.workspaceId,
        conversationId,
        contactId: input.contactId,
        config,
        result: {
          kind: "booked",
          booking: direct.result,
          messageHint: direct.messageHint,
        },
      });
    }
    if (direct.status === "book_failed") {
      return handleMctbAiBookingOrchestratorResult({
        workspaceId: input.workspaceId,
        conversationId,
        contactId: input.contactId,
        config,
        result: direct.orchestratorResult,
      });
    }
    /* no_offered_slots or customer asked for new search — fall through to availability */
  }

  const semanticCtx = await buildMctbSemanticConversationContext({
    workspaceId: input.workspaceId,
    conversationId,
    latestCustomerMessage: input.body,
  });

  const specialist = await runSchedulingSpecialistAgent({
    message: input.body,
    timezone: tz,
    nowIso: extras.nowIso,
    offeredSlots: session?.offeredSlots ?? [],
    aiBookingSessionActive: sessionActive,
    sessionStage: session?.stage,
    session,
    bookingConfig: extras.bookingConfig,
    semanticContext: semanticCtx,
    bookingAuthorized: input.forceSchedulingRoute === true,
  });

  if (specialist.needs_clarification && specialist.clarification_text) {
    return {
      handled: true,
      reply: specialist.clarification_text,
      action: "ai_booking_clarify",
    };
  }

  const orchestrateInput = mapSpecialistToOrchestratorInput(specialist, orchestrateBase, {
    sessionHasOfferedSlots: Boolean(session?.offeredSlots?.length),
    offeredSlots: session?.offeredSlots ?? [],
    referenceUtcIso: extras.nowIso,
  });
  if (!orchestrateInput) {
    return {
      handled: true,
      reply: specialist.clarification_text || "What day or time works best for you?",
      action: "ai_booking_clarify",
    };
  }

  logMctbAiBookingEvent("availability_query_started", {
    conversationId,
    scheduler_action: specialist.action,
  });

  const result = await orchestrateMctbAiBooking(orchestrateInput);

  return handleMctbAiBookingOrchestratorResult({
    workspaceId: input.workspaceId,
    conversationId,
    contactId: input.contactId,
    config,
    result,
  });
}
