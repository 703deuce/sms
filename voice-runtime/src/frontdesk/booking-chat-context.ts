import type { AgentSession } from "@livekit/agents";
import { resyncOpenAIRealtimeAgentChatCtx } from "../realtime-openai-chat-context";
import { deriveAuthoritativeBookingState } from "./booking-state";
import type { FrontDeskUserData } from "./userdata";

/**
 * Push authoritative booking confirmation into the OpenAI Realtime chat context.
 * SMS/email and scripted speech can succeed while the model never sees a tool success —
 * this makes BOOKING_COMPLETE visible even when chat item chains are corrupted.
 */
export async function injectBookingConfirmedChatContext(
  session: AgentSession<FrontDeskUserData>,
  bookedTimeLabel: string,
): Promise<void> {
  const agent = session.currentAgent;
  if (!agent) return;

  const state = deriveAuthoritativeBookingState(session.userData);
  const receipt = state.receipt;
  const content =
    `BOOKING_CONFIRMED_AUTHORITATIVE: Appointment IS confirmed for ${bookedTimeLabel}. ` +
    "Calendly write succeeded. A confirmation text was sent to the caller. " +
    "If they ask whether they are booked, say yes confidently for that time. " +
    "Do NOT say you are still waiting, checking, or putting it on the calendar. " +
    "Do NOT call check_booking_status unless they doubt the calendar after you confirm. " +
    JSON.stringify({
      status: "confirmed",
      booked_time_label: bookedTimeLabel,
      slot_id: receipt?.slotId ?? state.selectedSlotId ?? null,
      provider_event_id: receipt?.providerEventId ?? null,
      appointment_id: receipt?.appointmentId ?? null,
    });

  const chatCtx = agent.chatCtx.copy();
  chatCtx.addMessage({ role: "system", content });
  await agent.updateChatCtx(chatCtx);
  await resyncOpenAIRealtimeAgentChatCtx(agent);
}
