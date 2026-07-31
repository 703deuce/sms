import { InboxView } from "@/components/inbox/inbox-view";
import { Button } from "@/components/ui/button";
import {
  loadContacts,
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { Archive, MessageSquareText } from "lucide-react";
import Link from "next/link";

export default async function InboxPage() {
  const { workspaceId, session } = await requireWorkspaceContext();
  const [conversations, contacts, teamMembers] = await Promise.all([
    loadConversations(workspaceId),
    loadContacts(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

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
      />
    </div>
  );
}
