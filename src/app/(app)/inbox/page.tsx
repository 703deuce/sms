import {
  AllConversationsView,
  type ConversationTab,
} from "@/components/realtor/conversations/all-conversations-view";
import { isRealtorWorkspace } from "@/lib/realtor/workspace-config";
import { mergeRealtorConversations } from "@/lib/realtor/conversations-mock";
import {
  loadContacts,
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { InboxView } from "@/components/inbox/inbox-view";
import { Button } from "@/components/ui/button";
import { Archive, MessageSquareText } from "lucide-react";
import Link from "next/link";

const TAB_ALIASES: Record<string, ConversationTab> = {
  all: "all",
  mine: "mine",
  assigned: "mine",
  unassigned: "unassigned",
  unread: "unread",
  calls: "calls",
  sms: "sms",
  email: "email",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const params = await searchParams;
  const realtorMode = await isRealtorWorkspace(workspaceId);

  const [conversations, contacts, teamMembers] = await Promise.all([
    loadConversations(workspaceId),
    loadContacts(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  if (realtorMode) {
    const initialTab = TAB_ALIASES[params.tab || "all"] || "all";
    const merged = mergeRealtorConversations(conversations);

    return (
      <div className="px-2 py-4 lg:px-4">
        <AllConversationsView
          conversations={merged}
          contacts={contacts}
          teamMembers={teamMembers}
          currentUserName={session.name}
          currentUserId={session.userId}
          initialTab={initialTab}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[24px] font-bold tracking-tight">Inbox</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/inbox/saved-replies">
            <Button variant="outline" className="h-9 rounded-[10px] text-[13px]">
              <MessageSquareText className="h-4 w-4" />
              Saved replies
            </Button>
          </Link>
          <Link href="/inbox/archived">
            <Button variant="outline" className="h-9 rounded-[10px] text-[13px]">
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </Link>
        </div>
      </div>
      <InboxView
        conversations={conversations}
        contacts={contacts}
        teamMembers={teamMembers}
        currentUserName={session.name}
        currentUserId={session.userId}
      />
    </div>
  );
}
