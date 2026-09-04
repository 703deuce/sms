import "server-only";

import { listAppointmentTypes } from "@/lib/appointments/booking-platform";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { queryAvailabilityForIntent, formatSlotsForDisplay } from "./availability-bridge";
import { parseSchedulingIntent } from "./intent-parser";
import type { SchedulingIntent } from "./intent-schema";

export type AiSchedulingResponse = {
  intent: SchedulingIntent;
  slots?: Array<{ startsAt: string; endsAt: string }>;
  message: string;
  serviceName?: string;
  requiresFollowUp: boolean;
  requiresConfirmation: boolean;
  requiresBookingDetails: boolean;
  /** True when the selected appointment type requires deposit or full payment before confirmation */
  requiresPayment?: boolean;
  paymentMode?: "deposit" | "full";
};

const AI_RATE_LIMIT = new Map<string, number[]>();

function enforceRateLimit(workspaceId: string, maxPerMinute = 20): boolean {
  const now = Date.now();
  const key = workspaceId;
  const list = (AI_RATE_LIMIT.get(key) || []).filter((t) => t >= now - 60_000);
  if (list.length >= maxPerMinute) return false;
  list.push(now);
  AI_RATE_LIMIT.set(key, list);
  return true;
}

export async function processAiSchedulingRequest(input: {
  workspaceId: string;
  text: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AiSchedulingResponse> {
  if (!enforceRateLimit(input.workspaceId)) {
    return {
      intent: {
        intent: "availability_request",
        originalText: input.text,
        confidence: 0,
      },
      message:
        "We're receiving a lot of requests right now. Please try again in a moment or choose a time manually.",
      requiresFollowUp: false,
      requiresConfirmation: false,
      requiresBookingDetails: false,
    };
  }

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const types = (await listAppointmentTypes(input.workspaceId)).filter((t) => t.active);

  const intent = await parseSchedulingIntent({
    text: input.text,
    appointmentTypes: types.map((t) => ({ id: t.id, name: t.name })),
    timezone: platform.timezone,
    conversationHistory: input.conversationHistory,
  });

  if (intent.followUpQuestion && intent.missingFields?.length) {
    return {
      intent,
      message: intent.followUpQuestion,
      requiresFollowUp: true,
      requiresConfirmation: false,
      requiresBookingDetails: false,
    };
  }

  if (intent.intent === "cancel") {
    return {
      intent,
      message:
        "I can help you cancel. Please confirm you'd like to cancel your appointment, or use your cancellation link if you have one.",
      requiresFollowUp: false,
      requiresConfirmation: true,
      requiresBookingDetails: false,
    };
  }

  if (intent.intent === "reschedule") {
    return {
      intent,
      message: "I can help reschedule. What day or time would work better for you?",
      requiresFollowUp: true,
      requiresConfirmation: false,
      requiresBookingDetails: false,
    };
  }

  const serviceName =
    intent.appointmentTypeName ||
    types.find((t) => t.id === intent.appointmentTypeId)?.name ||
    types[0]?.name;

  if (!serviceName) {
    return {
      intent,
      message: "What type of appointment would you like to book?",
      requiresFollowUp: true,
      requiresConfirmation: false,
      requiresBookingDetails: false,
    };
  }

  const availability = await queryAvailabilityForIntent(
    input.workspaceId,
    intent,
    serviceName,
  );

  const slotDisplay = formatSlotsForDisplay(availability.slots, platform.timezone);
  const matchedType = types.find((t) => t.name === serviceName);
  const payment = matchedType?.config?.payment;
  const requiresPayment = Boolean(payment?.mode && payment.mode !== "none");
  const paymentNote = requiresPayment
    ? payment?.mode === "deposit"
      ? "\n\nA deposit is required to confirm this appointment. After you choose a time and enter your details, you'll complete secure payment before your booking is confirmed."
      : "\n\nPayment is required to confirm this appointment. After you choose a time and enter your details, you'll complete secure checkout before your booking is confirmed."
    : "";
  const message = `${availability.message}\n\n${slotDisplay}${paymentNote}`;

  return {
    intent,
    slots: availability.slots,
    serviceName,
    message,
    requiresFollowUp: availability.slots.length > 1,
    requiresConfirmation: availability.slots.length === 1 && !requiresPayment,
    requiresBookingDetails: false,
    requiresPayment,
    paymentMode: payment?.mode === "deposit" || payment?.mode === "full" ? payment.mode : undefined,
  };
}
