import { Suspense } from "react";
import { KimiConversationsConnected } from "@/components/inbox/kimi-conversations-connected";
import { inboxFiltersFromUrlParams } from "@/lib/inbox/conversation-url-filters";
import { loadInboxPermissions } from "@/lib/inbox/inbox-access";
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
  const [conversations, teamMembers, inboxPermissions] = await Promise.all([
    loadConversations(workspaceId, listFilters, session.userId),
    loadTeamMembers(workspaceId),
    loadInboxPermissions(workspaceId),
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
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading conversations…
        </div>
      }
    >
      <div
        className="kimi-surface kimi-conversations"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <KimiConversationsConnected
          initialConversations={conversations}
          teamMembers={teamMembers}
          currentUserId={session.userId}
          currentUserName={currentMember?.name ?? session.name ?? "You"}
          initialPermissions={inboxPermissions}
          initialConversationId={initialConversationId}
          initialContactId={initialContactId}
          initialDraft={initialDraft}
        />
      </div>
    </Suspense>
  );
}
