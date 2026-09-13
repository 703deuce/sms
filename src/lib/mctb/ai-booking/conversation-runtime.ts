/**
 * MCTB inbound SMS — AI Booking production runtime.
 * Booking Link remains separate; this path only runs when entitled + enabled.
 */
import { interpretSchedulingUtterance } from "@/lib/mctb/ai-booking/scheduling-interpreter";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
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

export type MctbAiBookingInboundResult =
  | { handled: false }
  | {
      handled: true;
      reply: string;
      action: "ai_booking" | "ai_booking_fallback" | "ai_booking_clarify";
    };

function resolveConversationId(
  conversationId: string | null | undefined,
  workspaceId: string,
  phone: string,
): string | null {
  if (conversationId) return conversationId;
  return null;
}

export async function handleMctbAiBookingInboundSms(input: {
  workspaceId: string;
  conversationId?: string | null;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  customerEmail?: string | null;
  body: string;
  timezone?: string;
}): Promise<MctbAiBookingInboundResult> {
  const config = await loadMctbAiBookingConfig(input.workspaceId);
  if (!config.enabled || config.upgradeRequired) {
    return { handled: false };
  }

  const conversationId = resolveConversationId(
    input.conversationId,
    input.workspaceId,
    input.customerPhone,
  );
  if (!conversationId) {
    return { handled: false };
  }

  const session = await getMctbAiBookingSessionStore().get(conversationId);
  const hasActiveSession =
    Boolean(session?.offeredSlots?.length) &&
    session?.stage === "AWAITING_SLOT_SELECTION";

  const interpretation = interpretSchedulingUtterance({
    text: input.body,
    timezone: input.timezone || config.timezone || "America/New_York",
    hasActiveBookingSession: hasActiveSession,
  });

  if (interpretation.intent === "NONE" && !hasActiveSession) {
    return { handled: false };
  }

  logMctbAiBookingEvent("booking_intent_detected", {
    workspaceId: input.workspaceId,
    conversationId,
    intent: interpretation.intent,
    hasActiveSession,
  });

  const readiness = await evaluateMctbAiBookingReadiness(input.workspaceId);
  if (!readiness.ready) {
    if (interpretation.needsClarification && interpretation.clarificationHint) {
      return { handled: true, reply: interpretation.clarificationHint, action: "ai_booking_clarify" };
    }
    const url = readiness.fallbackUrl;
    await recordMctbAiBookingFallbackActivity({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      reason: readiness.reason || "not_ready",
    });
    logMctbAiBookingEvent("fallback_link_sent", { conversationId, reason: readiness.reason });
    const reply = url
      ? `I'm unable to check live availability right now. You can choose a time here: ${url}`
      : "I'm unable to check live availability right now. Please reply with another time or call us back.";
    return { handled: true, reply, action: "ai_booking_fallback" };
  }

  if (interpretation.needsClarification && interpretation.clarificationHint && !hasActiveSession) {
    return {
      handled: true,
      reply: interpretation.clarificationHint,
      action: "ai_booking_clarify",
    };
  }

  const tz = interpretation.timezone;
  let orchestrateInput: Parameters<typeof orchestrateMctbAiBooking>[0] = {
    workspaceId: input.workspaceId,
    conversationId,
    contactId: input.contactId,
    customerName: input.customerName || "Guest",
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    windowStartUtc: interpretation.windowStartUtc || new Date().toISOString(),
    windowEndUtc:
      interpretation.windowEndUtc ||
      new Date(Date.now() + 24 * 3600_000).toISOString(),
    timezone: tz,
    specificTimeUtc: interpretation.preferredTimeUtc,
    choiceUtterance: interpretation.choiceUtterance,
    confirmBooking: interpretation.confirmBooking,
  };

  if (interpretation.intent === "SELECT_OFFERED_SLOT" || interpretation.intent === "CONFIRM_BOOKING") {
    orchestrateInput = {
      ...orchestrateInput,
      windowStartUtc: session?.lastQueriedWindow?.startUtc || orchestrateInput.windowStartUtc,
      windowEndUtc: session?.lastQueriedWindow?.endUtc || orchestrateInput.windowEndUtc,
      choiceUtterance: input.body,
      confirmBooking: interpretation.intent === "CONFIRM_BOOKING" || /\d|first|second|third|works/i.test(input.body),
    };
  }

  logMctbAiBookingEvent("availability_query_started", { conversationId });
  const result = await orchestrateMctbAiBooking(orchestrateInput);

  if (result.kind === "fallback_link") {
    await recordMctbAiBookingFallbackActivity({
      workspaceId: input.workspaceId,
      conversationId,
      contactId: input.contactId,
      reason: result.reason,
    });
    logMctbAiBookingEvent("fallback_link_sent", { conversationId, reason: result.reason });
    return { handled: true, reply: result.messageHint, action: "ai_booking_fallback" };
  }

  if (result.kind === "need_clarification") {
    return { handled: true, reply: result.messageHint, action: "ai_booking_clarify" };
  }

  if (result.kind === "booked") {
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
    return { handled: true, reply: result.messageHint, action: "ai_booking" };
  }

  logMctbAiBookingEvent("slots_offered", { conversationId, kind: result.kind });
  return { handled: true, reply: result.messageHint, action: "ai_booking" };
}
