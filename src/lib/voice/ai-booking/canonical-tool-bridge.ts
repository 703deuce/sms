import "server-only";

import type { AgentToolContext } from "@/lib/voice/agent-tool-gateway/types";
import type { CanonicalAvailabilityInput, CanonicalBookInput } from "@/lib/voice/agent-tool-gateway/types";
import { toolSuccess } from "@/lib/voice/agent-tool-gateway/envelope";
import { AgentToolError } from "@/lib/voice/agent-tool-gateway/errors";
import { resolveCanonicalBookingTimezone } from "@/lib/mctb/ai-booking/booking-timezone";
import { orchestrateMctbAiBooking } from "@/lib/mctb/ai-booking/orchestrator";
import { formatMctbBookingSlotLabel } from "@/lib/mctb/ai-booking/offered-slot-selection";
import type { AiBookingOrchestratorResult, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { getPrisma } from "@/lib/db";
import { voiceBookingConversationId } from "@/lib/voice/ai-booking/constants";
import {
  loadVoiceCallBookingContext,
  nextVoiceBookingWriteEpoch,
} from "@/lib/voice/ai-booking/call-context";
import { logVoiceAiBookingEvent } from "@/lib/voice/ai-booking/observability";

function availabilityWindow(
  input: CanonicalAvailabilityInput,
  bookingTimezone: string,
): { startUtc: string; endUtc: string; specificTimeUtc: string | null } {
  const now = new Date();
  const specific =
    input.resolved_time || input.start_time
      ? new Date(String(input.resolved_time || input.start_time)).toISOString()
      : null;
  const days = input.days_ahead != null ? Math.min(7, Math.max(1, input.days_ahead)) : 3;
  const startUtc = specific
    ? new Date(new Date(specific).getTime() - 2 * 3600_000).toISOString()
    : now.toISOString();
  const endUtc = specific
    ? new Date(new Date(specific).getTime() + 2 * 3600_000).toISOString()
    : new Date(now.getTime() + days * 86_400_000).toISOString();
  void bookingTimezone;
  return { startUtc, endUtc, specificTimeUtc: specific };
}

async function persistSlotsOnCall(input: {
  workspaceId: string;
  callId: string;
  slots: MctbBookingSlot[];
  serviceName: string;
}) {
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;
  const slotTimes = input.slots.map((s) => s.startUtc);
  await prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        metadata: {
          ...prevMeta,
          lastAvailabilitySlots: slotTimes,
          lastOfferedSlotIds: input.slots.map((s) => s.slotId),
          lastAvailabilityAt: new Date().toISOString(),
          lastAvailabilityService: input.serviceName,
          canonicalAiBooking: true,
        } as object,
      },
    })
    .catch(() => undefined);
}

function orchestratorToVoiceAvailability(
  result: AiBookingOrchestratorResult,
  slots: MctbBookingSlot[],
) {
  if (result.kind === "timezone_conflict") {
    throw new AgentToolError(
      "BOOKING_TIMEZONE_CONFLICT",
      result.code,
      false,
      "I hit a scheduling configuration issue. Let me have someone follow up to book you.",
    );
  }
  if (result.kind === "fallback_link") {
    return toolSuccess({
      status: "unavailable",
      user_message:
        result.messageHint ||
        "I'm having trouble checking the calendar right now. I can text you a booking link if you'd like.",
      data: { provider: "canonical", fallback: true, url: result.url || null },
    });
  }
  if (result.kind === "offer_slots" || result.kind === "specific_time") {
    const offered =
      result.kind === "offer_slots"
        ? result.slots
        : result.requestedAvailable && result.requestedSlot
          ? [result.requestedSlot]
          : result.alternatives || [];
    const speakSlots = offered.map((s, i) => ({
      index: i + 1,
      slot_id: s.slotId,
      start_time: s.startUtc,
      label: formatMctbBookingSlotLabel(s),
    }));
    const userMessage = result.messageHint
      ? result.messageHint
      : offered.length
        ? `Offer these times exactly (use slot_id when booking): ${speakSlots.map((s) => s.label).join("; ")}`
        : "No openings in that window.";
    return toolSuccess({
      status: offered.length ? "available" : "unavailable",
      user_message: userMessage,
      data: {
        provider: "canonical_mctb_orchestrator",
        slots: speakSlots,
        offered_slot_ids: speakSlots.map((s) => s.slot_id),
      },
    });
  }
  if (result.kind === "need_clarification") {
    return toolSuccess({
      status: "need_clarification",
      user_message: result.messageHint,
      data: { provider: "canonical", slots: slots.map((s) => ({ slot_id: s.slotId, start_time: s.startUtc })) },
    });
  }
  return toolSuccess({
    status: "unavailable",
    user_message: "I couldn't find openings for that time.",
    data: { provider: "canonical" },
  });
}

export async function runVoiceCanonicalAvailability(
  ctx: AgentToolContext,
  normalized: CanonicalAvailabilityInput,
) {
  if (!ctx.callId) {
    throw new AgentToolError("INVALID_INPUT", "callId required for voice AI booking");
  }
  const conversationId = voiceBookingConversationId(ctx.callId);
  const bookingTimezone = await resolveCanonicalBookingTimezone(ctx.workspaceId);
  const caller = await loadVoiceCallBookingContext({
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
  });
  const window = availabilityWindow(normalized, bookingTimezone);

  logVoiceAiBookingEvent("check_availability_start", {
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
    conversationId,
    bookingTimezone,
    window,
  });

  const result = await orchestrateMctbAiBooking({
    workspaceId: ctx.workspaceId,
    conversationId,
    contactId: caller.contactId,
    customerName: caller.customerName,
    customerPhone: caller.customerPhone,
    customerEmail: caller.customerEmail,
    windowStartUtc: window.startUtc,
    windowEndUtc: window.endUtc,
    timezone: bookingTimezone,
    specificTimeUtc: window.specificTimeUtc,
    confirmBooking: false,
  });

  const session = await getMctbAiBookingSessionStore().get(conversationId);
  const offered = session?.offeredSlots ?? [];
  if (offered.length) {
    await persistSlotsOnCall({
      workspaceId: ctx.workspaceId,
      callId: ctx.callId,
      slots: offered,
      serviceName: normalized.service_name,
    });
  }

  logVoiceAiBookingEvent("check_availability_complete", {
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
    conversationId,
    resultKind: result.kind,
    offeredCount: offered.length,
  });

  return orchestratorToVoiceAvailability(result, offered);
}

export async function runVoiceCanonicalBook(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
  normalized: CanonicalBookInput,
) {
  if (!ctx.callId) {
    throw new AgentToolError("INVALID_INPUT", "callId required for voice AI booking");
  }
  const conversationId = voiceBookingConversationId(ctx.callId);
  const bookingTimezone = await resolveCanonicalBookingTimezone(ctx.workspaceId);
  const caller = await loadVoiceCallBookingContext({
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
  });

  const offeredSlotId = String(
    raw.offered_slot_id || raw.offeredSlotId || raw.slot_id || raw.slotId || "",
  ).trim();

  const session = await getMctbAiBookingSessionStore().get(conversationId);
  let selectedSlotId = offeredSlotId;
  if (!selectedSlotId && normalized.start_time) {
    const match = session?.offeredSlots?.find((s) => s.startUtc === normalized.start_time);
    selectedSlotId = match?.slotId || "";
  }
  if (!selectedSlotId) {
    throw new AgentToolError(
      "INVALID_INPUT",
      "offered_slot_id required — book only canonical slots from calendar_availability",
      false,
      "I need you to pick one of the times I offered before I can book it.",
    );
  }

  const writeEpoch = await nextVoiceBookingWriteEpoch(ctx.callId);

  logVoiceAiBookingEvent("create_booking_start", {
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
    conversationId,
    selectedSlotId,
    writeEpoch,
  });

  const result = await orchestrateMctbAiBooking({
    workspaceId: ctx.workspaceId,
    conversationId,
    contactId: caller.contactId,
    customerName: normalized.customer_name || caller.customerName,
    customerPhone: normalized.customer_phone || caller.customerPhone,
    customerEmail: normalized.customer_email || caller.customerEmail,
    windowStartUtc: new Date().toISOString(),
    windowEndUtc: new Date(Date.now() + 3600_000).toISOString(),
    timezone: bookingTimezone,
    selectedSlotId,
    confirmBooking: true,
    writeEpoch,
  });

  if (result.kind === "booked") {
    logVoiceAiBookingEvent("booking_confirmed", {
      workspaceId: ctx.workspaceId,
      callId: ctx.callId,
      conversationId,
      providerBookingId: result.booking.providerBookingId,
      startUtc: result.booking.startUtc,
    });
    const label = formatMctbBookingSlotLabel({
      slotId: selectedSlotId,
      startUtc: result.booking.startUtc,
      endUtc: result.booking.endUtc,
      timezone: result.booking.timezone,
    });
    return toolSuccess({
      status: "confirmed",
      operation_id: normalized.operation_id,
      user_message: result.messageHint || `You're booked for ${label}.`,
      data: {
        provider: "canonical_mctb_orchestrator",
        provider_booking_id: result.booking.providerBookingId,
        start_time: result.booking.startUtc,
        end_time: result.booking.endUtc,
        offered_slot_id: selectedSlotId,
        may_confirm_to_caller: true,
        sync_status: "confirmed",
      },
    });
  }

  if (result.kind === "timezone_conflict") {
    throw new AgentToolError(
      "BOOKING_TIMEZONE_CONFLICT",
      result.code,
      false,
      "I hit a scheduling configuration issue and can't complete the booking on this call.",
    );
  }

  const hint =
    result.kind === "need_clarification"
      ? result.messageHint
      : result.kind === "fallback_link"
        ? result.messageHint
        : "That time is no longer available. I can check other openings.";

  throw new AgentToolError(
    "SLOT_UNAVAILABLE",
    result.kind,
    true,
    hint,
  );
}
