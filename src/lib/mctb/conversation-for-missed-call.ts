import "server-only";

import { getPrisma } from "@/lib/db";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";

export type MctbMissedCallConversationPayload = {
  id: string;
  unread: boolean;
  status: string;
  updatedAt: string;
  messages: Array<{
    body: string;
    createdAt: string;
    direction: string;
    userName: string | null;
  }>;
};

/**
 * Resolve the MCTB SMS thread for a missed-call event.
 * Prefer explicit missedCallEventId; fall back to caller line + time window when linking was missed.
 */
export async function resolveMctbConversationForMissedCall(
  workspaceId: string,
  event: {
    id: string;
    contactId: string | null;
    callerE164: string;
    detectedAt: Date;
  },
  options?: { messageTake?: number },
): Promise<MctbMissedCallConversationPayload | null> {
  const prisma = getPrisma();
  const productSource = appProductSourceToPrisma("mctb");
  const messageTake = options?.messageTake ?? 80;
  const select = {
    id: true,
    unread: true,
    status: true,
    updatedAt: true,
    missedCallEventId: true,
    messages: {
      orderBy: { createdAt: "asc" as const },
      take: messageTake,
      select: { body: true, createdAt: true, direction: true, userName: true },
    },
  };

  const byEventId = await prisma.conversation.findFirst({
    where: { workspaceId, productSource, missedCallEventId: event.id },
    orderBy: { updatedAt: "desc" },
    select,
  });
  if (byEventId) return serializeConversation(byEventId);

  const windowStart = new Date(event.detectedAt.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(event.detectedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const callerVariants = mctbCallerE164Variants(event.callerE164);
  const normalizedCaller = normalizeMctbCallerE164(event.callerE164);

  const byCallerLine = await prisma.conversation.findFirst({
    where: {
      workspaceId,
      productSource,
      updatedAt: { gte: windowStart, lte: windowEnd },
      OR: [
        { fromE164: { in: callerVariants } },
        { fromE164: normalizedCaller },
        {
          contact: {
            phone: { in: callerVariants },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select,
  });
  if (byCallerLine) return serializeConversation(byCallerLine);

  if (event.contactId) {
    const byContact = await prisma.conversation.findFirst({
      where: {
        workspaceId,
        productSource,
        contactId: event.contactId,
        updatedAt: { gte: windowStart },
      },
      orderBy: { updatedAt: "desc" },
      select,
    });
    if (byContact) return serializeConversation(byContact);
  }

  const contact = await prisma.contact.findFirst({
    where: { workspaceId, phone: { in: callerVariants } },
    select: { id: true },
  });
  if (contact) {
    const byContactPhone = await prisma.conversation.findFirst({
      where: {
        workspaceId,
        productSource,
        contactId: contact.id,
        updatedAt: { gte: windowStart },
      },
      orderBy: { updatedAt: "desc" },
      select,
    });
    if (byContactPhone) return serializeConversation(byContactPhone);
  }

  return null;
}

function serializeConversation(conv: {
  id: string;
  unread: boolean;
  status: string;
  updatedAt: Date;
  messages: Array<{
    body: string;
    createdAt: Date;
    direction: string;
    userName: string | null;
  }>;
}): MctbMissedCallConversationPayload {
  return {
    id: conv.id,
    unread: conv.unread,
    status: conv.status,
    updatedAt: conv.updatedAt.toISOString(),
    messages: conv.messages.map((m) => ({
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      direction: m.direction,
      userName: m.userName,
    })),
  };
}
