import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  ensureProductConversation,
  resolvePhoneForInbound,
} from "@/lib/mass-texting/conversation-context";

/** Ensure outbound MCTB recovery SMS appears in the workspace inbox thread. */
export async function ensureMctbRecoveryConversation(input: {
  workspaceId: string;
  toE164: string;
  fromE164: string;
  body: string;
  providerMessageId?: string | null;
  missedCallEventId?: string | null;
  /** Outbound sender PhoneNumber id (platform or workspace) — aids shared-sender inbound routing. */
  outboundSmsPhoneNumberId?: string | null;
}): Promise<{ conversationId: string | null }> {
  const prisma = getPrisma();
  let to = input.toE164;
  try {
    to = normalizeE164(input.toE164);
  } catch {
    return { conversationId: null };
  }

  if (input.providerMessageId) {
    const dup = await prisma.conversationMessage.findFirst({
      where: { providerMessageId: input.providerMessageId },
      select: { conversationId: true },
    });
    if (dup) return { conversationId: dup.conversationId };
  }

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: to } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: input.workspaceId,
        phone: to,
        consentSource: "mctb_recovery",
      },
    });
  }

  const fromPhone = await resolvePhoneForInbound(input.workspaceId, input.fromE164);
  const senderPhoneNumberId = input.outboundSmsPhoneNumberId ?? fromPhone?.id ?? null;
  const { conversationId } = await ensureProductConversation({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    productSource: "mctb",
    phoneNumberId: senderPhoneNumberId,
    fromE164: input.fromE164,
    missedCallEventId: input.missedCallEventId ?? null,
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId,
      direction: "outbound",
      body: input.body,
      providerMessageId: input.providerMessageId || undefined,
      fromE164: input.fromE164,
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: false, updatedAt: new Date() },
  });

  return { conversationId };
}
