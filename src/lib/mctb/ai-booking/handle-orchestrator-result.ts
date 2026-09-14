import { getPrisma } from "@/lib/db";
import { phraseAiBookingSmsReply } from "@/lib/mctb/ai-booking/agents/response-phrasing";
import {
  formatBookingConfirmedEventText,
  recordMctbAiBookingFallbackActivity,
  recordMctbBookingConfirmedActivity,
} from "@/lib/mctb/ai-booking/activity";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import type { AiBookingOrchestratorResult } from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingInboundResult } from "@/lib/mctb/ai-booking/conversation-runtime-types";
import { finalizeMctbOutboundSms } from "@/lib/mctb/sms-channel";
import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";

export async function handleMctbAiBookingOrchestratorResult(input: {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  config: MctbAiBookingWorkspaceConfig;
  result: AiBookingOrchestratorResult;
}): Promise<MctbAiBookingInboundResult> {
  const { workspaceId, conversationId, contactId, config, result } = input;

  if (result.kind === "fallback_link") {
    await recordMctbAiBookingFallbackActivity({
      workspaceId,
      conversationId,
      contactId,
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
    return {
      handled: true,
      reply: finalizeMctbOutboundSms(result.messageHint),
      action: "ai_booking_clarify",
    };
  }

  if (result.kind === "booked") {
    const { loadLeadRecoveryState, saveLeadRecoveryState } = await import(
      "@/lib/mctb/lead-recovery/state-store"
    );
    const lrState = await loadLeadRecoveryState({ workspaceId, conversationId });
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
      workspaceId,
      conversationId,
      contactId,
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
    if (prisma.conversationMessage?.create) {
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
    }
    await getMctbAiBookingSessionStore().clear(conversationId);
    const reply = await phraseAiBookingSmsReply({
      facts: {
        booking_confirmed: true,
        start: result.booking.startUtc,
        end: result.booking.endUtc,
        timezone: result.booking.timezone,
      },
      fallbackText: result.messageHint,
    });
    return { handled: true, reply, action: "ai_booking" };
  }

  if (result.kind === "offer_slots") {
    logMctbAiBookingEvent("slots_offered", {
      conversationId,
      kind: result.kind,
      count: result.slots.length,
    });
    return {
      handled: true,
      reply: finalizeMctbOutboundSms(result.messageHint),
      action: "ai_booking",
    };
  }

  const slotLabels =
    result.kind === "specific_time" ? result.alternatives.map((s) => s.startUtc) : [];

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
