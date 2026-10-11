import "server-only";

import { notifyWorkspace } from "@/lib/notifications/in-app";
import { getPrisma } from "@/lib/db";
import { recordArSmsCustomerOutcome } from "@/lib/appointment-reminders/record-ar-sms-outcome";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

/**
 * Notify-mode Starter/Growth/Business: persist free-text SMS (e.g. "running late")
 * on the appointment timeline and alert staff. No automated reply to the customer.
 */
export async function tryRecordNotifyModeFreeTextReply(input: {
  workspaceId: string;
  appointmentId: string;
  replySessionId?: string;
  body: string;
  providerMessageId?: string;
}): Promise<void> {
  const snippet = input.body.trim();
  if (!snippet) return;

  const displaySnippet = snippet.length > 500 ? `${snippet.slice(0, 497)}...` : snippet;

  await recordArSmsCustomerOutcome({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    outcome: "customer_message",
    label: "Customer replied",
    note: displaySnippet,
    evidence: {
      channel: "sms",
      direction: "inbound",
      messageText: displaySnippet,
      providerMessageId: input.providerMessageId,
    },
  });

  const row = await getPrisma().voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: { serviceName: true, inviteeName: true },
  });
  const who = row?.inviteeName?.trim() || "A customer";
  const preview = displaySnippet.length > 120 ? `${displaySnippet.slice(0, 117)}...` : displaySnippet;

  await notifyWorkspace(input.workspaceId, {
    type: "system",
    title: "Customer replied to reminder",
    body: `${who}: ${preview}`,
    href: AR_ROUTES.responses,
  });
}
