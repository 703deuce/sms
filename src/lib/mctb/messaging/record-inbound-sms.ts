/**
 * Persist inbound SMS on the MCTB / Lead Recovery path only.
 * Does not run mass-texting, inbox AI, away replies, or campaign automations.
 */
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
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
  let from = input.from;
  try {
    from = normalizeE164(input.from);
  } catch {
    /* keep */
  }
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

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
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

  const { resolveInboundConversation } = await import("@/lib/mass-texting/conversation-context");
  const inboundCtx = await resolveInboundConversation({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    toE164: input.to,
    fromE164: from,
  });

  const conversation = await prisma.conversation.update({
    where: { id: inboundCtx.conversationId },
    data: { unread: true, updatedAt: new Date(), productSource: "MCTB" },
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
