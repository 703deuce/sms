import { Suspense } from "react";
import ConversationsFlow from "@/components/kimi/conversations/ConversationsFlow";
import {
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";

export default async function ConversationsPage() {
  const { workspaceId, session } = await requireWorkspaceContext();
  const [conversations, teamMembers] = await Promise.all([
    loadConversations(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  const currentMember = teamMembers.find((m) => m.id === session.userId);

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading conversations…</p>}>
      <div className="kimi-surface kimi-conversations">
        <ConversationsFlow
          initialConversations={conversations}
          teamMembers={teamMembers}
          currentUserId={session.userId}
          currentUserName={currentMember?.name ?? session.name ?? "You"}
        />
      </div>
    </Suspense>
  );
}
