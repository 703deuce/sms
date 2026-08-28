import { InboxView } from "@/components/inbox/inbox-view";
import { parseInboxSearchParams } from "@/lib/mass-texting/inbox-filters";
import {
  loadContacts,
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";

/** Primary SMS shared inbox — three-column workspace with optional contact drawer. */
export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const params = await searchParams;
  const urlSearch = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlSearch.set(key, value);
  }
  const filters = parseInboxSearchParams(urlSearch);

  const [conversations, contacts, teamMembers] = await Promise.all([
    loadConversations(workspaceId, filters),
    loadContacts(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  const initialFilter =
    filters.filter === "mine"
      ? "Mine"
      : filters.filter === "unassigned"
        ? "Unassigned"
        : filters.filter === "archived"
          ? "Closed"
          : filters.unread
            ? "Unread"
            : "All conversations";

  return (
    <InboxView
      initialFilter={initialFilter}
      conversations={conversations}
      contacts={contacts}
      teamMembers={teamMembers}
      currentUserName={session.name}
      currentUserId={session.userId}
    />
  );
}
