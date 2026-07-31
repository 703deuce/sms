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

export default async function InboxUnassignedPage() {
  const { workspaceId, session } = await requireWorkspaceContext();
  const [conversations, contacts, teamMembers] = await Promise.all([
    loadConversations(workspaceId),
    loadContacts(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  return (
    <div>
      <PageHeader
        title="Unassigned"
        description="New inbound messages waiting for a team member to claim."
        actions={
          <Link href="/inbox">
            <Button variant="outline">All conversations</Button>
          </Link>
        }
      />
      <InboxView
        initialFilter="Unassigned"
        conversations={conversations}
        contacts={contacts}
        teamMembers={teamMembers}
        currentUserName={session.name}
      />
    </div>
  );
}
