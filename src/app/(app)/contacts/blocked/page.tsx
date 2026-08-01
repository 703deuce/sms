import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getActiveWorkspaceId } from "@/lib/auth";
import { contactTabs } from "@/lib/contact-tabs";
import type { Contact } from "@/lib/types";
import { loadContacts } from "@/lib/workspace-data";
import { formatPhone } from "@/lib/utils";
import { Ban } from "lucide-react";
import Link from "next/link";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BlockedContactsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Blocked" description="Contacts blocked from messaging." />

      <Tabs items={contactTabs} />
        <EmptyState title="No workspace selected" description="Select or create a workspace to view contacts." />
      </div>
    );
  }

  const filtered: Contact[] = await loadContacts(workspaceId, "BLOCKED");

  return (
    <div>
      <PageHeader
        title="Blocked"
        description="Contacts blocked from messaging due to spam reports, abuse, or manual suppression."
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
              <TH>Tags</TH>
              <TH>Date added</TH>
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
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.length > 0 ? (
                      contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </TD>
                <TD className="text-muted-foreground">{formatDate(contact.dateAdded)}</TD>
                <TD>
                  <div className="flex gap-1">
                    <Link href={`/contacts/${contact.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm">
                      Unblock
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState
          icon={<Ban className="h-10 w-10" />}
          title="No blocked contacts"
          description="Blocked contacts are excluded from all outbound messaging and automations."
          actionLabel="View all contacts"
          actionHref="/contacts"
        />
      )}
    </div>
  );
}
