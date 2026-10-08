import "server-only";

import { getPrisma } from "@/lib/db";
import {
  mctbCallerE164Variants,
} from "@/lib/mctb/messaging/caller-e164";
import { handleAppointmentRemindersInboundBody } from "@/lib/appointment-reminders/messaging/handle-inbound-body";

/**
 * @deprecated Use platform toll-free router + `ar_process_inbound_sms` worker.
 * Kept for scripts that call the handler directly.
 */
export async function tryHandleAppointmentRemindersPlatformInbound(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
  providerMessageId?: string;
  conversationId?: string;
}): Promise<{ handled: true; replyText: string } | { handled: false }> {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(input.fromE164);
  const contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: { in: variants } },
    select: { id: true },
  });
  if (!contact) return { handled: false };

  return handleAppointmentRemindersInboundBody({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    fromE164: input.fromE164,
    body: input.body,
    providerMessageId: input.providerMessageId,
    conversationId: input.conversationId,
  });
}
