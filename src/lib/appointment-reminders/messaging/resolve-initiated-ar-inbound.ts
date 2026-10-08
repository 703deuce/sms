import "server-only";

import type { ArSmsReplySession } from "@/lib/domain";
import {
  findPersistentArConversationId,
  groupArSessionsByWorkspace,
  listArInboundRoutableSessions,
  pickPrimaryArReplySessionForInbound,
  syncArReplySessionsToConversation,
} from "./persistent-conversation";

export type ResolveInitiatedArInboundResult =
  | { status: "matched"; session: ArSmsReplySession; conversationId: string | null }
  | { status: "ambiguous_workspace"; workspaceIds: string[]; sessions: ArSmsReplySession[] }
  | { status: "none" };

/**
 * Match inbound SMS to Appointment Reminders threads Transovo already started.
 * Key: customer E.164 + platform sender + workspace (multiple appointments share one conversation).
 */
export async function resolveArInboundFromOutboundInitiatedConversation(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<ResolveInitiatedArInboundResult> {
  const sessions = await listArInboundRoutableSessions(input);
  if (!sessions.length) {
    return { status: "none" };
  }

  const byWorkspace = groupArSessionsByWorkspace(sessions);
  if (byWorkspace.size > 1) {
    return {
      status: "ambiguous_workspace",
      workspaceIds: [...byWorkspace.keys()],
      sessions,
    };
  }

  const workspaceSessions = sessions;
  const workspaceId = workspaceSessions[0]!.workspaceId;
  const primary = pickPrimaryArReplySessionForInbound(workspaceSessions);
  if (!primary) {
    return { status: "none" };
  }

  let conversationId = primary.conversationId;
  if (!conversationId) {
    conversationId = await findPersistentArConversationId({
      workspaceId,
      consumerE164: input.consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
    });
  }

  if (conversationId) {
    await syncArReplySessionsToConversation({
      workspaceId,
      consumerE164: input.consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      conversationId,
    });
  }

  const session: ArSmsReplySession = conversationId && !primary.conversationId
    ? { ...primary, conversationId }
    : primary;

  return { status: "matched", session, conversationId };
}
