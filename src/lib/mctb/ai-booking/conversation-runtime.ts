/**
 * MCTB inbound SMS — AI Booking production runtime (multi-agent + deterministic orchestrator).
 */
import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { orchestrateMctbAiBooking } from "@/lib/mctb/ai-booking/orchestrator";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import {
  recordMctbAiBookingFallbackActivity,
  recordMctbBookingConfirmedActivity,
  formatBookingConfirmedEventText,
} from "@/lib/mctb/ai-booking/activity";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";
import { getPrisma } from "@/lib/db";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import {
  runIntentRouterAgent,
  shouldRouteToScheduling,
} from "@/lib/mctb/ai-booking/agents/router";
import { runSchedulingSpecialistAgent } from "@/lib/mctb/ai-booking/agents/scheduling-specialist";
import { mapSpecialistToOrchestratorInput } from "@/lib/mctb/ai-booking/agents/map-to-orchestrator";
import { phraseAiBookingSmsReply } from "@/lib/mctb/ai-booking/agents/response-phrasing";

export type MctbAiBookingInboundResult =
  | { handled: false }
  | {
      handled: true;
      reply: string;
      action: "ai_booking" | "ai_booking_fallback" | "ai_booking_clarify";
    };

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
  const sessionActive = Boolean(session?.offeredSlots?.length);
  const awaitingSelection = session?.stage === "AWAITING_SLOT_SELECTION";

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
  const [semanticCtx, extras] = await Promise.all([
    buildMctbSemanticConversationContext({
      workspaceId: input.workspaceId,
      conversationId,
      latestCustomerMessage: input.body,
    }),
    schedulingSpecialistContextExtras({ workspaceId: input.workspaceId, timezone: tz }),
  ]);

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

  const orchestrateBase = {
    workspaceId: input.workspaceId,
    conversationId,
    contactId: input.contactId,
    customerName: input.customerName || "Guest",
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    timezone: tz,
    customerMessage: input.body,
    writeEpoch: input.writeEpoch,
  };

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

  if (result.kind === "fallback_link") {
    await recordMctbAiBookingFallbackActivity({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      reason: result.reason,
    });
    logMctbAiBookingEvent("fallback_used", { conversationId, reason: result.reason });
    const reply = await phraseAiBookingSmsReply({
      facts: { fallback: true, url: result.url, reason: result.reason },
      fallbackText: result.messageHint,
    });
    return { handled: true, reply, action: "ai_booking_fallback" };
  }

  if (result.kind === "need_clarification") {
    const reply = await phraseAiBookingSmsReply({
      facts: { clarify: true, hint: result.messageHint },
      fallbackText: result.messageHint,
    });
    return { handled: true, reply, action: "ai_booking_clarify" };
  }

  if (result.kind === "booked") {
    const { loadLeadRecoveryState, saveLeadRecoveryState } = await import(
      "@/lib/mctb/lead-recovery/state-store"
    );
    const lrState = await loadLeadRecoveryState({
      workspaceId: input.workspaceId,
      conversationId,
    });
    const processedKeys = [
      ...(lrState.processedActionKeys ?? []),
      `mctb-book:${conversationId}:${result.booking.providerBookingId}`,
    ].slice(-100);
    await saveLeadRecoveryState({
      ...lrState,
      processedActionKeys: processedKeys,
      pendingAction: null,
      phase: "COMPLETE",
    }).catch(() => undefined);

    logMctbAiBookingEvent("booking_confirmed", {
      conversationId,
      providerBookingId: result.booking.providerBookingId,
    });
    const title = config.serviceName || "Appointment";
    await recordMctbBookingConfirmedActivity({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      payload: {
        provider: result.booking.provider,
        providerBookingId: result.booking.providerBookingId,
        title,
        startUtc: result.booking.startUtc,
        endUtc: result.booking.endUtc,
        timezone: result.booking.timezone,
      },
    });
    const prisma = getPrisma();
    if (!prisma.conversationMessage?.create) {
      await getMctbAiBookingSessionStore().clear(conversationId);
      const reply = await phraseAiBookingSmsReply({
        facts: {
          booking_confirmed: true,
          start: result.booking.startUtc,
          timezone: result.booking.timezone,
        },
        fallbackText: result.messageHint,
      });
      return { handled: true, reply, action: "ai_booking" };
    }
    await prisma.conversationMessage.create({
      data: {
        conversationId,
        direction: "event",
        body: formatBookingConfirmedEventText({
          provider: result.booking.provider,
          providerBookingId: result.booking.providerBookingId,
          title,
          startUtc: result.booking.startUtc,
          endUtc: result.booking.endUtc,
          timezone: result.booking.timezone,
        }),
        userName: "System",
      },
    });
    await getMctbAiBookingSessionStore().clear(conversationId);
    const reply = await phraseAiBookingSmsReply({
      facts: {
        booking_confirmed: true,
        start: result.booking.startUtc,
        timezone: result.booking.timezone,
      },
      fallbackText: result.messageHint,
    });
    return { handled: true, reply, action: "ai_booking" };
  }

  const slotLabels =
    result.kind === "offer_slots"
      ? result.slots.map((s) => s.startUtc)
      : result.kind === "specific_time"
        ? result.alternatives.map((s) => s.startUtc)
        : [];

  logMctbAiBookingEvent("slots_offered", {
    conversationId,
    kind: result.kind,
    count: slotLabels.length,
  });

  const reply = await phraseAiBookingSmsReply({
    facts: {
      kind: result.kind,
      message_hint: result.messageHint,
      slots: slotLabels,
      requested_available:
        result.kind === "specific_time" ? result.requestedAvailable : undefined,
    },
    fallbackText: result.messageHint,
  });

  return { handled: true, reply, action: "ai_booking" };
}
