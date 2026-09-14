/**
 * Persist inbound SMS on the MCTB / Lead Recovery path only.
 * Does not run mass-texting, inbox AI, away replies, or campaign automations.
 */
import { getPrisma } from "@/lib/db";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import type { InboundProcessResult } from "@/lib/messaging/inbound-process";

function formatInboundMessageBody(body: string, mediaUrls?: string[] | null): string {
  const trimmed = (body || "").trim();
  const mediaCount = mediaUrls?.filter(Boolean).length || 0;
  if (trimmed) return trimmed;
  if (mediaCount > 0) return "";
  return "(empty)";
}

export async function recordMctbInboundSmsForLeadRecovery(input: {
  workspaceId: string;
  from: string;
  to: string;
  body: string;
  providerMessageId?: string | null;
  mediaUrls?: string[] | null;
}): Promise<InboundProcessResult> {
  const prisma = getPrisma();
  const from = normalizeMctbCallerE164(input.from);
  const callerVariants = mctbCallerE164Variants(input.from);
  const body = (input.body || "").trim();

  if (input.providerMessageId) {
    const existingMsg = await prisma.conversationMessage.findFirst({
      where: { providerMessageId: input.providerMessageId },
      select: { conversationId: true },
    });
    if (existingMsg) {
      return {
        kind: body ? "message" : "empty",
        conversationId: existingMsg.conversationId,
      };
    }
  }

  let contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: { in: callerVariants } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { workspaceId: input.workspaceId, phone: from, lastReply: new Date() },
    });
  } else {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { lastReply: new Date() },
    });
  }

  const recentMissed = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerE164: { in: callerVariants },
      smsSentAt: { not: null },
    },
    orderBy: { smsSentAt: "desc" },
    select: { id: true },
  });

  const { resolveInboundConversation } = await import("@/lib/mass-texting/conversation-context");
  const inboundCtx = await resolveInboundConversation({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    toE164: input.to,
    fromE164: from,
  });

  const conversation = await prisma.conversation.update({
    where: { id: inboundCtx.conversationId },
    data: {
      unread: true,
      updatedAt: new Date(),
      productSource: "MCTB",
      ...(recentMissed ? { missedCallEventId: recentMissed.id } : {}),
    },
  });

  const displayBody = formatInboundMessageBody(body, input.mediaUrls);
  const inboundMedia = input.mediaUrls?.filter(Boolean) ?? [];
  try {
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        body: displayBody,
        mediaUrls: inboundMedia,
        providerMessageId: input.providerMessageId || null,
      },
    });
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
  }

  return {
    kind: body ? "message" : "empty",
    conversationId: conversation.id,
  };
}
