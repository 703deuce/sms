import "server-only";

import { getPrisma } from "@/lib/db";
import { arPersistentConversationHistorySince } from "@/lib/appointment-reminders/messaging/persistent-conversation";
import {
  appendCurrentInboundIfNeeded,
  type ArLunaConversationMessage,
} from "./luna-conversation-merge";

export type { ArLunaConversationMessage };

/**
 * Chronological SMS thread for Luna on the persistent customer conversation (inbound + outbound).
 */
export async function loadArSmsConversationForLuna(input: {
  workspaceId: string;
  replySessionId: string;
  contactId: string;
  conversationId: string;
  currentMessage: string;
  currentProviderMessageId?: string;
}): Promise<{ messages: ArLunaConversationMessage[]; sessionOk: true } | { sessionOk: false; reason: string }> {
  const prisma = getPrisma();
  const session = await prisma.arSmsReplySession.findFirst({
    where: { id: input.replySessionId, workspaceId: input.workspaceId },
    select: {
      id: true,
      contactId: true,
      conversationId: true,
    },
  });
  if (!session) return { sessionOk: false, reason: "session_not_found" };
  if (session.contactId !== input.contactId) {
    return { sessionOk: false, reason: "session_identity_mismatch" };
  }

  const conversationId = session.conversationId || input.conversationId;
  if (!conversationId) {
    return { sessionOk: false, reason: "conversation_scope_missing" };
  }

  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!conv) {
    return { sessionOk: false, reason: "conversation_scope_mismatch" };
  }

  const since = arPersistentConversationHistorySince();
  const rows = await prisma.conversationMessage.findMany({
    where: {
      conversationId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
    select: {
      direction: true,
      body: true,
      providerMessageId: true,
    },
  });

  const messages: ArLunaConversationMessage[] = [];
  for (const row of rows) {
    const text = (row.body || "").trim();
    if (!text) continue;
    messages.push({
      role: row.direction === "inbound" ? "user" : "assistant",
      content: text,
    });
  }

  const merged = appendCurrentInboundIfNeeded(
    messages,
    rows,
    input.currentMessage,
    input.currentProviderMessageId,
  );

  return { sessionOk: true, messages: merged };
}
