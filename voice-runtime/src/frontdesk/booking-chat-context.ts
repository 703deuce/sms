import type { AgentSession } from "@livekit/agents";
import { deriveAuthoritativeBookingState } from "./booking-state";
import type { FrontDeskUserData } from "./userdata";
import { injectAuthoritativeToolOutcome } from "../tool-outcome-context";

/**
 * Push authoritative booking confirmation into the OpenAI Realtime chat context.
 * SMS/email and scripted speech can succeed while the model never sees a tool success —
 * this makes BOOKING_COMPLETE visible even when chat item chains are corrupted.
 */
export async function injectBookingConfirmedChatContext(
  session: AgentSession<FrontDeskUserData>,
  bookedTimeLabel: string,
): Promise<void> {
  const state = deriveAuthoritativeBookingState(session.userData);
  const receipt = state.receipt;

  await injectAuthoritativeToolOutcome(session, {
    headline: "BOOKING_CONFIRMED_AUTHORITATIVE:",
    detail:
      `Appointment IS confirmed for ${bookedTimeLabel}. Calendly write succeeded. ` +
      "A confirmation text was sent. If they ask whether they are booked, say yes confidently. " +
      "Do NOT say you are still waiting, checking, or putting it on the calendar.",
    payload: {
      status: "confirmed",
      booked_time_label: bookedTimeLabel,
      slot_id: receipt?.slotId ?? state.selectedSlotId ?? null,
      provider_event_id: receipt?.providerEventId ?? null,
      appointment_id: receipt?.appointmentId ?? null,
    },
  });
}
