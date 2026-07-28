import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { formatPhone } from "@/lib/utils";
import { Archive } from "lucide-react";
import Link from "next/link";

const archivedConversations = [
  {
    id: "arch_1",
    contactName: "Tom Reyes",
    phone: "+14155550201",
    lastMessage: "Thanks, all set!",
    assignedTo: "Jordan Lee",
    archivedAt: "2026-07-10T14:22:00Z",
  },
  {
    id: "arch_2",
    contactName: "Elena Park",
    phone: "+14155550212",
    lastMessage: "Please remove me from promos.",
    assignedTo: "Alex Rivera",
    archivedAt: "2026-07-05T09:15:00Z",
  },
];

export default function InboxArchivedPage() {
  const hasArchived = archivedConversations.length > 0;

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

      {hasArchived ? (
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
                <TD>{c.assignedTo}</TD>
                <TD className="text-muted-foreground">
                  {new Date(c.archivedAt).toLocaleDateString(undefined, {
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
