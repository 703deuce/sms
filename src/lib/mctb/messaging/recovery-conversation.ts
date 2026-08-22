import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/** Ensure outbound MCTB recovery SMS appears in the workspace inbox thread. */
export async function ensureMctbRecoveryConversation(input: {
  workspaceId: string;
  toE164: string;
  fromE164: string;
  body: string;
  providerMessageId?: string | null;
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
        source: "mctb_recovery",
      },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contactId: contact.id,
      status: { not: "CLOSED" },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId: input.workspaceId,
        contactId: contact.id,
        status: "OPEN",
        unread: false,
      },
    });
  }

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body: input.body,
      providerMessageId: input.providerMessageId || undefined,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return { conversationId: conversation.id };
}
