import { Suspense } from "react";
import { KimiConversationsConnected } from "@/components/inbox/kimi-conversations-connected";
import { inboxFiltersFromUrlParams } from "@/lib/inbox/conversation-url-filters";
import {
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const params = await searchParams;
  const listFilters = inboxFiltersFromUrlParams(params);
  const [conversations, teamMembers] = await Promise.all([
    loadConversations(workspaceId, listFilters),
    loadTeamMembers(workspaceId),
  ]);

  const currentMember = teamMembers.find((m) => m.id === session.userId);
  const initialConversationId =
    typeof params.conversation === "string" ? params.conversation : null;
  const initialContactId =
    (typeof params.contactId === "string" && params.contactId) ||
    (typeof params.contact === "string" && params.contact) ||
    null;
  const initialDraft =
    typeof params.draft === "string" ? decodeURIComponent(params.draft) : "";

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading conversations…</p>}>
      <div className="kimi-surface kimi-conversations">
        <KimiConversationsConnected
          initialConversations={conversations}
          teamMembers={teamMembers}
          currentUserId={session.userId}
          currentUserName={currentMember?.name ?? session.name ?? "You"}
          initialConversationId={initialConversationId}
          initialContactId={initialContactId}
          initialDraft={initialDraft}
        />
      </div>
    </Suspense>
  );
}
