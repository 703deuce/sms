import "server-only";

import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";

export async function ensureMctbConversationForRecovery(input: {
  workspaceId: string;
  missedCallEventId: string;
  callerE164: string;
  businessE164: string;
  phoneNumberId: string | null;
  contactId: string | null;
}): Promise<{ conversationId: string; contactId: string }> {
  const prisma = getPrisma();
  const caller = normalizeE164(input.callerE164);

  const byEvent = await prisma.conversation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      productSource: "MCTB",
      missedCallEventId: input.missedCallEventId,
    },
    select: { id: true, contactId: true },
  });
  if (byEvent) {
    return { conversationId: byEvent.id, contactId: byEvent.contactId };
  }

  let contactId = input.contactId;
  if (!contactId) {
    const existing = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone: caller },
      select: { id: true },
    });
    if (existing) {
      contactId = existing.id;
    } else {
      const created = await prisma.contact.create({
        data: { workspaceId: input.workspaceId, phone: caller },
        select: { id: true },
      });
      contactId = created.id;
    }
  }

  const conv = await prisma.conversation.create({
    data: {
      workspaceId: input.workspaceId,
      contactId,
      productSource: "MCTB",
      missedCallEventId: input.missedCallEventId,
      phoneNumberId: input.phoneNumberId,
      fromE164: input.businessE164,
      status: "OPEN",
      unread: false,
    },
    select: { id: true, contactId: true },
  });

  return { conversationId: conv.id, contactId: conv.contactId };
}
