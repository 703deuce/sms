import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { formatPhone } from "@/lib/utils";
import {
  loadConversations,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { Archive } from "lucide-react";
import Link from "next/link";

export default async function InboxArchivedPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const conversations = await loadConversations(workspaceId);
  const archivedConversations = conversations.filter((c) => c.status === "Closed");

  return (
    <div>
      <PageHeader
        title="Archived"
        description="Closed conversations moved out of your active inbox queue."
        actions={
          <Link href="/inbox">
            <Button variant="outline">Back to inbox</Button>
          </Link>
        }
      />

      {archivedConversations.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Contact</TH>
              <TH>Last message</TH>
              <TH>Assigned to</TH>
              <TH>Archived</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {archivedConversations.map((c) => (
              <TR key={c.id}>
                <TD>
                  <p className="font-medium">{c.contactName}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(c.phone)}</p>
                </TD>
                <TD className="max-w-xs truncate text-muted-foreground">{c.lastMessage}</TD>
                <TD>{c.assignedTo || "Unassigned"}</TD>
                <TD className="text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD>
                  <StatusChip status="Archived" />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState
          icon={<Archive className="h-10 w-10" />}
          title="No archived conversations"
          description="When you archive closed threads, they'll appear here for reference without cluttering your active inbox."
          actionLabel="Open inbox"
          actionHref="/inbox"
        />
      )}
    </div>
  );
}
