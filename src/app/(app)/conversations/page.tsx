import { Suspense } from "react";
import { KimiConversationsConnected } from "@/components/inbox/kimi-conversations-connected";
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
        <KimiConversationsConnected
          initialConversations={conversations}
          teamMembers={teamMembers}
          currentUserId={session.userId}
          currentUserName={currentMember?.name ?? session.name ?? "You"}
        />
      </div>
    </Suspense>
  );
}
