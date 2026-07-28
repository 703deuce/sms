import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contacts } from "@/lib/mock/data";
import { formatNumber, formatPhone } from "@/lib/utils";
import { Download, Upload, UserPlus } from "lucide-react";
import Link from "next/link";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ContactsPage() {
  const subscribed = contacts.filter((c) => c.status === "Subscribed").length;

  return (
    <div>
      <PageHeader
        title="All contacts"
        description="Manage subscribers, consent records, lists, and tags for your messaging audience."
        actions={
          <>
            <Button variant="outline">
              <UserPlus className="h-4 w-4" />
              Add contact
            </Button>
            <Link href="/contacts/imports">
              <Button variant="outline">
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </Link>
            <Link href="/contacts/imports">
              <Button variant="outline">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </Link>
          </>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contacts" value={formatNumber(contacts.length)} />
        <StatCard label="Subscribed" value={formatNumber(subscribed)} />
        <StatCard
          label="Unsubscribed"
          value={formatNumber(contacts.filter((c) => c.status === "Unsubscribed").length)}
          href="/contacts/unsubscribed"
        />
        <StatCard
          label="Invalid / blocked"
          value={formatNumber(
            contacts.filter((c) => c.status === "Invalid" || c.status === "Blocked").length,
          )}
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input placeholder="Search by name, phone, or email…" className="max-w-sm" />
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/contacts/unsubscribed" className="text-primary hover:underline">
              Unsubscribed
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/contacts/blocked" className="text-primary hover:underline">
              Blocked
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/contacts/invalid" className="text-primary hover:underline">
              Invalid
            </Link>
          </div>
        </div>
      </Card>

      <Table>
        <THead>
          <TR>
            <TH className="w-10">
              <input type="checkbox" aria-label="Select all contacts" className="rounded border-border" />
            </TH>
            <TH>Name</TH>
            <TH>Phone</TH>
            <TH>Email</TH>
            <TH>Status</TH>
            <TH>Lists</TH>
            <TH>Tags</TH>
            <TH>Consent source</TH>
            <TH>Consent date</TH>
            <TH>Last messaged</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {contacts.map((contact) => (
            <TR key={contact.id}>
              <TD>
                <input type="checkbox" aria-label={`Select ${contact.firstName} ${contact.lastName}`} className="rounded border-border" />
              </TD>
              <TD>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {contact.firstName} {contact.lastName}
                </Link>
                {contact.company ? (
                  <p className="text-xs text-muted-foreground">{contact.company}</p>
                ) : null}
              </TD>
              <TD>{formatPhone(contact.phone)}</TD>
              <TD className="text-muted-foreground">{contact.email || "—"}</TD>
              <TD>
                <StatusChip status={contact.status} />
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {contact.lists.length > 0 ? (
                    contact.lists.map((list) => (
                      <span
                        key={list}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                      >
                        {list}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.length > 0 ? (
                    contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TD>
              <TD className="text-muted-foreground">{contact.consentSource}</TD>
              <TD className="text-muted-foreground">{formatDate(contact.consentDate)}</TD>
              <TD className="text-muted-foreground">{formatDate(contact.lastMessaged)}</TD>
              <TD>
                <div className="flex gap-1">
                  <Link href={`/contacts/${contact.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                  <Link href={`/send/quick`}>
                    <Button variant="ghost" size="sm">
                      Message
                    </Button>
                  </Link>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
