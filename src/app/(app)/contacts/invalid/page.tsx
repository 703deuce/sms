import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import { contactTabs } from "@/lib/contact-tabs";
import type { Contact } from "@/lib/types";
import { loadContacts } from "@/lib/workspace-data";
import { formatPhone } from "@/lib/utils";
import { PhoneOff } from "lucide-react";
import Link from "next/link";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function InvalidContactsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Invalid numbers" description="Landlines, malformed numbers, or unreachable devices." />
        <EmptyState title="No workspace selected" description="Select or create a workspace to view contacts." />
      </div>
    );
  }

  const filtered: Contact[] = await loadContacts(workspaceId, "INVALID");

  return (
    <div>
      <PageHeader
        title="Invalid numbers"
        description="Landlines, malformed numbers, or unreachable devices detected during validation or delivery."
        actions={
          <>
            <Link href="/contacts">
              <Button variant="outline">All contacts</Button>
            </Link>
            <Link href="/contacts/imports">
              <Button variant="outline">Re-import corrected</Button>
            </Link>
          </>
        }
      />
      <Tabs items={contactTabs} />

      {filtered.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH>Lists</TH>
              <TH>Consent source</TH>
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
                <TD>
                  <StatusChip status={contact.status} />
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {contact.lists.length > 0 ? (
                      contact.lists.map((list) => (
                        <span
                          key={list}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {list}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </TD>
                <TD className="text-muted-foreground">{contact.consentSource}</TD>
                <TD className="text-muted-foreground">{formatDate(contact.dateAdded)}</TD>
                <TD>
                  <div className="flex gap-1">
                    <Link href={`/contacts/${contact.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm">
                      Remove
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState
          icon={<PhoneOff className="h-10 w-10" />}
          title="No invalid numbers"
          description="Invalid numbers are flagged automatically and excluded from sends to protect deliverability."
          actionLabel="View all contacts"
          actionHref="/contacts"
        />
      )}
    </div>
  );
}
