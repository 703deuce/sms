import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PaginationBar,
  SectionHeader,
  TableToolbar,
} from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contactTabs } from "@/lib/contact-tabs";
import { contacts } from "@/lib/mock/data";
import { formatPhone } from "@/lib/utils";
import { Ban, Download, MoreHorizontal, Shield, Users } from "lucide-react";
import Link from "next/link";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default function BlockedContactsPage() {
  const filtered = contacts.filter((c) => c.status === "Blocked");

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={Shield}
        iconTone="bg-emerald-50 text-emerald-600"
        title="Blocked"
        description="Contacts blocked from messaging due to spam reports, abuse, or manual suppression."
        actions={
          <>
            <Link href="/contacts">
              <Button variant="outline" className="rounded-[10px]">
                <Users className="h-4 w-4" />
                All contacts
              </Button>
            </Link>
            <Button className="rounded-[10px]">
              <Download className="h-4 w-4" />
              Export list
            </Button>
          </>
        }
      />

      <Tabs items={contactTabs} />

      {filtered.length > 0 ? (
        <Card className="rounded-[12px] p-4">
          <TableToolbar
            title={`${filtered.length} contact${filtered.length === 1 ? "" : "s"}`}
            searchPlaceholder="Search blocked contacts..."
          >
            <Button variant="outline" size="sm" className="rounded-[10px]">
              Filters
            </Button>
          </TableToolbar>

          <Table className="text-[13px]">
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
                      className="inline-flex items-center gap-2.5 font-semibold text-foreground hover:text-primary"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                        {initials(contact.firstName, contact.lastName)}
                      </span>
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
                            className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
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
                    <div className="flex items-center gap-1">
                      <Link href={`/contacts/${contact.id}`}>
                        <Button variant="ghost" size="sm" className="text-[12px] text-primary">
                          View
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="text-[12px]">
                        Unblock
                      </Button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                        aria-label={`More actions for ${contact.firstName}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <PaginationBar
            rangeLabel={`Showing ${filtered.length} of ${filtered.length} contact${filtered.length === 1 ? "" : "s"}`}
          />
        </Card>
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
