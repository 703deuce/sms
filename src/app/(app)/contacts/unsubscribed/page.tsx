import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getActiveWorkspaceId } from "@/lib/auth";
import type { Contact } from "@/lib/types";
import { loadContacts } from "@/lib/workspace-data";
import { formatPhone } from "@/lib/utils";
import { UserMinus } from "lucide-react";
import Link from "next/link";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function UnsubscribedContactsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Unsubscribed" description="Contacts who opted out via STOP or manual unsubscribe." />
        <EmptyState title="No workspace selected" description="Select or create a workspace to view contacts." />
      </div>
    );
  }

  const filtered: Contact[] = await loadContacts(workspaceId, "UNSUBSCRIBED");

  return (
    <div>
      <PageHeader
        title="Unsubscribed"
        description="Contacts who opted out via STOP or manual unsubscribe. They cannot receive campaigns."
        actions={
          <>
            <Link href="/contacts">
              <Button variant="outline">All contacts</Button>
            </Link>
            <Button variant="outline">Export list</Button>
          </>
        }
      />

      {filtered.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Phone</TH>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH>Consent source</TH>
              <TH>Consent date</TH>
              <TH>Last messaged</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((contact) => (
              <TR key={contact.id}>
                <TD>
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {contact.firstName} {contact.lastName}
                  </Link>
                </TD>
                <TD>{formatPhone(contact.phone)}</TD>
                <TD className="text-muted-foreground">{contact.email || "—"}</TD>
                <TD>
                  <StatusChip status={contact.status} />
                </TD>
                <TD className="text-muted-foreground">{contact.consentSource}</TD>
                <TD className="text-muted-foreground">{formatDate(contact.consentDate)}</TD>
                <TD className="text-muted-foreground">{formatDate(contact.lastMessaged)}</TD>
                <TD>
                  <Link href={`/contacts/${contact.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState
          icon={<UserMinus className="h-10 w-10" />}
          title="No unsubscribed contacts"
          description="When contacts reply STOP or are manually unsubscribed, they'll appear here."
          actionLabel="View all contacts"
          actionHref="/contacts"
        />
      )}
    </div>
  );
}
