import "server-only";

import {
  beginArCancelPendingAfterPolicyAck,
  continueArRescheduleAfterPolicyAcceptance,
  handleArCancelConfirmation,
  handleArReminderLetterReply,
} from "@/lib/appointment-reminders/ai-rescheduler/inbound-replies";
import { tryHandleArSmsPolicyAckForAppointment } from "@/lib/appointment-reminders/ai-rescheduler/ar-sms-policy-ack-inbound";
import { getArSmsPolicyAck, awaitingPolicyAcceptance } from "@/lib/appointment-reminders/ai-rescheduler/ar-sms-policy-ack";
import { isAiReschedulerSmsEnabled } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
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

  const { workspaceAllowsSmsCustomerResponses } = await import(
    "@/lib/appointment-reminders/commercial/ar-feature-gates"
  );
  const smsResponsesAllowed = await workspaceAllowsSmsCustomerResponses(input.workspaceId);
  if (!smsResponsesAllowed) {
    const upper = body.toUpperCase();
    const looksLikeReply =
      upper === "C" || upper === "R" || upper === "X" || /^(yes|y)$/i.test(body);
    if (looksLikeReply) {
      return {
        handled: true,
        replyText:
          "SMS replies aren't included on the Free plan. Upgrade to Starter in Appointment Reminders settings to confirm, reschedule, or cancel by text.",
      };
    }
    return { handled: false };
  }

  const { resolveArAiReschedulerConfigForWorkspace } = await import(
    "@/lib/appointment-reminders/commercial/ar-ai-rescheduler-plan"
  );
  const ar = await resolveArAiReschedulerConfigForWorkspace(input.workspaceId);
  if (isAiReschedulerSmsEnabled(ar)) {
    const apptRow = await getPrisma().voiceAppointment.findFirst({
      where: { id: input.appointmentId, workspaceId: input.workspaceId },
      select: { metadata: true, startsAt: true, timezone: true },
    });
    const meta = (apptRow?.metadata || {}) as AppointmentMetadata;
    if (awaitingPolicyAcceptance(meta)) {
      const whenLabel = apptRow?.startsAt
        ? apptRow.startsAt.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: apptRow.timezone || undefined,
          })
        : "your appointment";
      const ack = getArSmsPolicyAck(meta);
      const policyTurn = await tryHandleArSmsPolicyAckForAppointment({
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        appointmentId: input.appointmentId,
        replySessionId: input.replySessionId,
        conversationId: input.conversationId,
        body,
        providerMessageId: input.providerMessageId,
        whenLabel,
        ar,
        onCancelAccepted: async () =>
          beginArCancelPendingAfterPolicyAck({
            workspaceId: input.workspaceId,
            contactId: input.contactId,
            appointmentId: input.appointmentId,
            replySessionId: input.replySessionId,
            whenLabel,
            meta,
          }),
        onRescheduleAccepted: async () => {
          const r = await continueArRescheduleAfterPolicyAcceptance({
            workspaceId: input.workspaceId,
            contactId: input.contactId,
            appointmentId: input.appointmentId,
            replySessionId: input.replySessionId,
            whenLabel,
            meta,
            ar,
          });
          return r.replyText;
        },
      });
      if (policyTurn.handled) {
        logArSmsPipeline({
          step: "inbound_handler_branch",
          workspaceId: input.workspaceId,
          replySessionId: input.replySessionId,
          appointmentId: input.appointmentId,
          conversationId: input.conversationId,
          providerMessageId: input.providerMessageId,
          handler: "policy_ack",
          branch: ack?.action ?? "unknown",
          inboundKind,
          bodyLength,
        });
        return { handled: true, replyText: policyTurn.replyText };
      }
    }
  }

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
      providerMessageId: input.providerMessageId,
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
