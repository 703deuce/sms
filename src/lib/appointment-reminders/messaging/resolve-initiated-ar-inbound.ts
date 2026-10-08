import "server-only";

import type { ArSmsReplySession } from "@/lib/domain";
import {
  findPersistentArConversationId,
  groupArSessionsByWorkspace,
  listArInboundRoutableSessions,
  resolveArInboundPrimarySession,
  syncArReplySessionsToConversation,
} from "./persistent-conversation";
import { logArSmsPipeline } from "./pipeline-log";

export type ResolveInitiatedArInboundResult =
  | { status: "matched"; session: ArSmsReplySession; conversationId: string | null }
  | { status: "ambiguous_workspace"; workspaceIds: string[]; sessions: ArSmsReplySession[] }
  | { status: "ambiguous_appointment"; appointmentIds: string[]; sessions: ArSmsReplySession[] }
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
  logArSmsPipeline({
    step: "route_sessions_listed",
    platformPhoneNumberId: input.platformPhoneNumberId,
    sessionCount: sessions.length,
    meta: {
      appointmentIds: sessions.map((s) => s.appointmentId),
      lifecycleStates: sessions.map((s) => s.lifecycleState),
    },
  });
  if (!sessions.length) {
    return { status: "none" };
  }

  const byWorkspace = groupArSessionsByWorkspace(sessions);
  if (byWorkspace.size > 1) {
    logArSmsPipeline({
      step: "route_ambiguous_workspace",
      platformPhoneNumberId: input.platformPhoneNumberId,
      sessionCount: sessions.length,
      workspaceIds: [...byWorkspace.keys()],
    });
    return {
      status: "ambiguous_workspace",
      workspaceIds: [...byWorkspace.keys()],
      sessions,
    };
  }

  const workspaceSessions = sessions;
  const workspaceId = workspaceSessions[0]!.workspaceId;
  const primaryRes = resolveArInboundPrimarySession(workspaceSessions);
  if (primaryRes.status === "none") {
    return { status: "none" };
  }
  if (primaryRes.status === "ambiguous_appointment") {
    logArSmsPipeline({
      step: "route_ambiguous_appointment",
      workspaceId,
      platformPhoneNumberId: input.platformPhoneNumberId,
      sessionCount: workspaceSessions.length,
      meta: { appointmentIds: primaryRes.appointmentIds },
    });
    return {
      status: "ambiguous_appointment",
      appointmentIds: primaryRes.appointmentIds,
      sessions: workspaceSessions,
    };
  }
  const primary = primaryRes.session;

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

  logArSmsPipeline({
    step: "route_matched",
    workspaceId,
    platformPhoneNumberId: input.platformPhoneNumberId,
    primarySessionId: primary.id,
    replySessionId: session.id,
    appointmentId: session.appointmentId,
    conversationId,
    sessionCount: workspaceSessions.length,
    lifecycleState: session.lifecycleState,
    meta: { syncedConversation: Boolean(conversationId) },
  });

  return { status: "matched", session, conversationId };
}
