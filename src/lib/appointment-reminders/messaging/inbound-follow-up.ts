import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { isAiReschedulerSmsEnabled, resolveAiReschedulerConfig } from "../ai-rescheduler/types";
import { runArV3RescheduleSmsTurn } from "../ai-rescheduler/v3-workflow/run-turn";
import { verifyArReplySessionForInboundTurn } from "./verify-reply-session";

/**
 * Platform AR SMS follow-up — every turn bound to ArSmsReplySession (no contact heuristics).
 */
export async function tryHandleArReminderFollowUp(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId: string;
  conversationId?: string;
  message: string;
  providerMessageId?: string;
}): Promise<{ handled: true; replyText: string } | { handled: false }> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (!isAiReschedulerSmsEnabled(ar) || ar.mode !== "ai") {
    return { handled: false };
  }

  const verified = await verifyArReplySessionForInboundTurn({
    sessionId: input.replySessionId,
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
  });
  if (!verified.ok) return { handled: false };

  const v3 = await runArV3RescheduleSmsTurn({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
    message: input.message,
    providerMessageId: input.providerMessageId,
  });
  if (!v3.handled) return { handled: false };
  return { handled: true, replyText: v3.replyText };
}
