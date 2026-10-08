import "server-only";

import { getPrisma } from "@/lib/db";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import { handleArReminderLetterReply } from "./inbound-replies";
import { tryHandleArReminderFollowUp } from "./inbound-follow-up";

/**
 * Platform toll-free inbound is shared with MCTB. Appointment reminder C/R/X and
 * post-R conversation must be handled before MCTB lead recovery.
 */
export async function tryHandleAppointmentRemindersPlatformInbound(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
  providerMessageId?: string;
  conversationId?: string;
}): Promise<{ handled: true; replyText: string } | { handled: false }> {
  const prisma = getPrisma();
  const from = normalizeMctbCallerE164(input.fromE164);
  const variants = mctbCallerE164Variants(input.fromE164);
  const body = (input.body || "").trim();
  if (!body) return { handled: false };

  const contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: { in: variants } },
    select: { id: true },
  });
  if (!contact) return { handled: false };

  const upper = body.toUpperCase();
  if (upper === "C" || upper === "R" || upper === "X") {
    const arReply = await handleArReminderLetterReply({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      conversationId: input.conversationId,
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
    contactId: contact.id,
    message: body,
    providerMessageId: input.providerMessageId,
  });
  if (followUp.handled) {
    return { handled: true, replyText: followUp.replyText };
  }

  return { handled: false };
}
