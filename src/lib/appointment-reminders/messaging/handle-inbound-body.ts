import "server-only";

import {
  handleArCancelConfirmation,
  handleArReminderLetterReply,
} from "@/lib/appointment-reminders/ai-rescheduler/inbound-replies";
import { tryHandleArReminderFollowUp } from "@/lib/appointment-reminders/messaging/inbound-follow-up";
import { classifyArInboundBody, logArSmsPipeline } from "./pipeline-log";

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
  const { inboundKind, bodyLength } = classifyArInboundBody(body);
  if (!body) return { handled: false };

  if (/^(yes|y)$/i.test(body)) {
    const arCancel = await handleArCancelConfirmation({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      appointmentId: input.appointmentId,
    });
    if (arCancel.handled && arCancel.replyText) {
      logArSmsPipeline({
        step: "inbound_handler_branch",
        workspaceId: input.workspaceId,
        replySessionId: input.replySessionId,
        appointmentId: input.appointmentId,
        conversationId: input.conversationId,
        providerMessageId: input.providerMessageId,
        handler: "cancel_confirmation",
        branch: "yes",
        inboundKind,
        bodyLength,
      });
      return { handled: true, replyText: arCancel.replyText };
    }
  }

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
      logArSmsPipeline({
        step: "inbound_handler_branch",
        workspaceId: input.workspaceId,
        replySessionId: input.replySessionId,
        appointmentId: input.appointmentId,
        conversationId: input.conversationId,
        providerMessageId: input.providerMessageId,
        handler: "reminder_letter",
        branch: upper,
        inboundKind,
        bodyLength,
      });
      return { handled: true, replyText: arReply.replyText };
    }
    logArSmsPipeline({
      step: "inbound_handler_unhandled",
      workspaceId: input.workspaceId,
      replySessionId: input.replySessionId,
      providerMessageId: input.providerMessageId,
      handler: "reminder_letter",
      branch: `${upper}_not_handled`,
      inboundKind,
    });
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
    logArSmsPipeline({
      step: "inbound_handler_branch",
      workspaceId: input.workspaceId,
      replySessionId: input.replySessionId,
      appointmentId: input.appointmentId,
      conversationId: input.conversationId,
      providerMessageId: input.providerMessageId,
      handler: "luna_follow_up",
      branch: "v3_reschedule",
      inboundKind,
      bodyLength,
    });
    return { handled: true, replyText: followUp.replyText };
  }

  logArSmsPipeline({
    step: "inbound_handler_unhandled",
    workspaceId: input.workspaceId,
    replySessionId: input.replySessionId,
    providerMessageId: input.providerMessageId,
    handler: "none",
    inboundKind,
    bodyLength,
  });
  return { handled: false };
}
