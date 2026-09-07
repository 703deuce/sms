import "server-only";

import { openAiChatCompletion } from "@/lib/ai/openai";
import { RESPONSE_COMPOSER_SYSTEM_PROMPT } from "./prompts";
import type { ResolverOutcome } from "./schema";

const SAFE_FALLBACK =
  "I couldn't process that request right now. You can use the booking options below or try again.";

export async function composeAppointmentResponse(
  outcome: ResolverOutcome,
  options?: { channel?: "sms" | "email" | "public_booking" | "conversation"; useLlm?: boolean },
): Promise<string> {
  if (!options?.useLlm) {
    return deterministicCompose(outcome);
  }

  const payload = JSON.stringify({
    status: outcome.status,
    reason: outcome.reason,
    slots: outcome.slots?.slice(0, 5),
    appointments: outcome.appointments,
    appointment: outcome.appointment,
    serviceName: outcome.serviceName,
    paymentMode: outcome.paymentMode,
    checkoutUrl: outcome.checkoutUrl ? "[secure checkout link provided]" : undefined,
  });

  try {
    const raw = await openAiChatCompletion(
      RESPONSE_COMPOSER_SYSTEM_PROMPT,
      `Authoritative result:\n${payload}\n\nWrite the customer-facing reply:`,
      { temperature: 0.3, maxTokens: 250 },
    );
    if (raw?.trim()) return raw.trim();
  } catch {
    /* fall through */
  }
  return deterministicCompose(outcome);
}

export function deterministicCompose(outcome: ResolverOutcome): string {
  switch (outcome.status) {
    case "AVAILABLE_OPTIONS":
      if (!outcome.slots?.length) {
        return "I couldn't find matching times. Would you like to try a different day?";
      }
      return outcome.reason || "Here are available times I found:";
    case "CLARIFICATION_REQUIRED":
      return outcome.reason || "Could you share a bit more detail so I can help?";
    case "BOOKING_CONFIRMED":
      return outcome.reason || "Your appointment is booked.";
    case "RESCHEDULED":
      return outcome.reason || "Your appointment has been rescheduled.";
    case "CANCELED":
      return outcome.reason || "Your appointment has been canceled.";
    case "CONFIRMED":
      return outcome.reason || "Thanks — your appointment is confirmed.";
    case "PAYMENT_REQUIRED":
      return (
        outcome.reason ||
        "This appointment requires payment before it can be confirmed. Please complete secure checkout."
      );
    case "WAITLIST_JOINED":
      return outcome.reason || "You've been added to the waitlist. We'll notify you if a spot opens.";
    case "APPOINTMENT_DETAILS":
      if (outcome.appointment) {
        return `Your ${outcome.appointment.serviceName} is scheduled for ${new Date(outcome.appointment.startsAt).toLocaleString()}.`;
      }
      return outcome.reason || "Here are your appointment details.";
    case "POLICY_ANSWER":
      return outcome.reason || "Please check our booking policies on the booking page.";
    case "OUT_OF_SCOPE":
      return "I can help with booking, changing, confirming, or canceling appointments.";
    case "ERROR":
      return SAFE_FALLBACK;
    case "NO_OP":
    default:
      return outcome.reason || SAFE_FALLBACK;
  }
}

export { SAFE_FALLBACK };
