import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { phraseAiBookingSmsReply } from "@/lib/mctb/ai-booking/agents/response-phrasing";
import type { MctbAiBookingInboundResult } from "@/lib/mctb/ai-booking/conversation-runtime-types";

export async function sendMctbBookingLinkSmsReply(input: {
  workspaceId: string;
  customerMessage: string;
  schedulingNote?: string | null;
}): Promise<MctbAiBookingInboundResult> {
  const config = await loadMctbAiBookingConfig(input.workspaceId);
  const url = await resolveFallbackBookingUrl(input.workspaceId, config);
  const fallback = url
    ? `You can pick a time here: ${url}`
    : "We’ll send you a booking link shortly — what day works best for you?";
  const reply = await phraseAiBookingSmsReply({
    facts: {
      booking_link: url,
      scheduling_request: true,
      customer_message: input.customerMessage,
      note: input.schedulingNote,
    },
    fallbackText: fallback,
  });
  return { handled: true, reply, action: "ai_booking_link" };
}
