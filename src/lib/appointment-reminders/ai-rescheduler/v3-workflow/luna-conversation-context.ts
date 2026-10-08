import "server-only";

import { getPrisma } from "@/lib/db";
import {
  appendCurrentInboundIfNeeded,
  type ArLunaConversationMessage,
} from "./luna-conversation-merge";

export type { ArLunaConversationMessage };

/**
 * Full chronological SMS thread for one AR reply session (inbound + outbound).
 * Scoped by session + conversation + appointment — never phone-only.
 */
export async function loadArSmsConversationForLuna(input: {
  workspaceId: string;
  replySessionId: string;
  appointmentId: string;
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
      appointmentId: true,
      contactId: true,
      conversationId: true,
    },
  });
  if (!session) return { sessionOk: false, reason: "session_not_found" };
  if (session.appointmentId !== input.appointmentId || session.contactId !== input.contactId) {
    return { sessionOk: false, reason: "session_identity_mismatch" };
  }
  if (!session.conversationId || session.conversationId !== input.conversationId) {
    return { sessionOk: false, reason: "conversation_scope_mismatch" };
  }

  const rows = await prisma.conversationMessage.findMany({
    where: { conversationId: input.conversationId },
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
