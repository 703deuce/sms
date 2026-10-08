import "server-only";

import { handleArReminderLetterReply } from "@/lib/appointment-reminders/ai-rescheduler/inbound-replies";
import { tryHandleArReminderFollowUp } from "@/lib/appointment-reminders/messaging/inbound-follow-up";

export async function handleAppointmentRemindersInboundBody(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId: string;
  fromE164: string;
  body: string;
  providerMessageId?: string;
  conversationId?: string;
}): Promise<{ handled: true; replyText: string } | { handled: false }> {
  const body = (input.body || "").trim();
  if (!body) return { handled: false };

  const upper = body.toUpperCase();
  if (upper === "C" || upper === "R" || upper === "X") {
    const arReply = await handleArReminderLetterReply({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      explicitAppointmentId: input.appointmentId,
      replySessionId: input.replySessionId,
      body,
      letter: upper as "C" | "R" | "X",
    });
    if (arReply.handled && arReply.replyText) {
      return { handled: true, replyText: arReply.replyText };
    }
    return { handled: false };
  }

  const followUp = await tryHandleArReminderFollowUp({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
    message: body,
    providerMessageId: input.providerMessageId,
  });
  if (followUp.handled) {
    return { handled: true, replyText: followUp.replyText };
  }

  return { handled: false };
}
