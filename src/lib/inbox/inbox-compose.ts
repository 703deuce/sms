import "server-only";

import { getPrisma } from "@/lib/db";
import { ensureProductConversation } from "@/lib/mass-texting/conversation-context";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type RecordInboxComposeInput = {
  workspaceId: string;
  to: string;
  body: string;
  fromE164?: string | null;
  mediaUrls?: string[];
  userName?: string | null;
};

/** After a quick SMS send from inbox compose, ensure a conversation thread exists with the outbound message. */
export async function recordInboxComposeSend(
  input: RecordInboxComposeInput,
): Promise<{ conversationId: string }> {
  const prisma = getPrisma();
  const to = normalizeE164(input.to);
  const body = input.body.trim();
  const mediaUrls = input.mediaUrls?.filter(Boolean) ?? [];

  const contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: to } },
    select: { id: true },
  });
  if (!contact) {
    throw new Error("Contact record missing after send");
  }

  let phoneNumberId: string | null = null;
  const fromE164 = input.fromE164?.trim() || null;
  if (fromE164) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { workspaceId: input.workspaceId, e164: fromE164, status: "Active" },
      select: { id: true },
    });
    phoneNumberId = phone?.id ?? null;
  } else {
    const { pickPreferredSmsSendingNumber } = await import(
      "@/lib/messaging/preferred-sending-number"
    );
    const owned = await prisma.phoneNumber.findMany({
      where: { workspaceId: input.workspaceId, status: "Active" },
    });
    phoneNumberId = pickPreferredSmsSendingNumber(owned)?.id ?? null;
  }

  const { conversationId } = await ensureProductConversation({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    productSource: "manual",
    phoneNumberId,
    fromE164,
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId,
      direction: "out",
      body: body || (mediaUrls.length ? "" : ""),
      mediaUrls,
      userName: input.userName ?? null,
      fromE164,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: false, status: "OPEN", updatedAt: new Date() },
  });

  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastMessaged: new Date() },
  });

  return { conversationId };
}
