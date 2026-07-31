import { InboxView } from "@/components/inbox/inbox-view";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  loadContacts,
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import Link from "next/link";

export default async function InboxMinePage() {
  const { workspaceId, session } = await requireWorkspaceContext();
  const [conversations, contacts, teamMembers] = await Promise.all([
    loadConversations(workspaceId),
    loadContacts(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  return (
    <div>
      <PageHeader
        title="Assigned to me"
        description="Conversations assigned to you or your team aliases."
        actions={
          <Link href="/inbox">
            <Button variant="outline">All conversations</Button>
          </Link>
        }
      />
      <InboxView
        initialFilter="Mine"
        conversations={conversations}
        contacts={contacts}
        teamMembers={teamMembers}
        currentUserName={session.name}
      />
    </div>
  );
}
