import { InboxView } from "@/components/inbox/inbox-view";
import { InboxProductFilters } from "@/components/inbox/inbox-product-filters";
import { Button } from "@/components/ui/button";
import { parseInboxSearchParams } from "@/lib/mass-texting/inbox-filters";
import {
  loadContacts,
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { Archive, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

/** Primary SMS messaging inbox — threads, replies, attachments, filters. */
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
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[24px] font-bold tracking-tight">Conversations</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/conversations/saved-replies">
            <Button variant="outline" className="h-9 rounded-[10px] text-[13px]">
              <MessageSquareText className="h-4 w-4" />
              Saved replies
            </Button>
          </Link>
          <Link href="/conversations?filter=archived">
            <Button variant="outline" className="h-9 rounded-[10px] text-[13px]">
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </Link>
        </div>
      </div>
      <Suspense fallback={null}>
        <InboxProductFilters basePath="/conversations" />
      </Suspense>
      <InboxView
        initialFilter={initialFilter}
        conversations={conversations}
        contacts={contacts}
        teamMembers={teamMembers}
        currentUserName={session.name}
        currentUserId={session.userId}
      />
    </div>
  );
}
