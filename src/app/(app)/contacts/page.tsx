import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import { ExportContactsButton } from "@/components/contacts/export-contacts-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import type { Contact } from "@/lib/types";
import { loadContacts } from "@/lib/workspace-data";
import { cn, formatNumber, formatPercent, formatPhone } from "@/lib/utils";
import {
  Ban,
  MoreHorizontal,
  SlidersHorizontal,
  Upload,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import Link from "next/link";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

const avatarTones = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
];

const statusLegend = [
  { label: "Unsubscribed", dot: "bg-orange-500" },
  { label: "Blocked", dot: "bg-red-500" },
  { label: "Invalid", dot: "bg-pink-500" },
];

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function ContactsPage() {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return (
      <div className="text-[13px]">
        <SectionHeader
          icon={Users}
          title="All contacts"
          description="Manage subscribers, consent records, lists, and tags for your messaging audience."
        />
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No workspace selected"
          description="Select or create a workspace to view contacts."
        />
      </div>
    );
  }

  const contacts: Contact[] = await loadContacts(workspaceId);
  const total = contacts.length;
  const subscribed = contacts.filter((c) => c.status === "Subscribed").length;
  const unsubscribed = contacts.filter((c) => c.status === "Unsubscribed").length;
  const invalidBlocked = contacts.filter(
    (c) => c.status === "Invalid" || c.status === "Blocked",
  ).length;
  const subscribedPct = total > 0 ? (subscribed / total) * 100 : 0;
  const unsubscribedPct = total > 0 ? (unsubscribed / total) * 100 : 0;
  const invalidBlockedPct = total > 0 ? (invalidBlocked / total) * 100 : 0;

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={Users}
        title="All contacts"
        description="Manage subscribers, consent records, lists, and tags for your messaging audience."
        actions={
          <>
            <AddContactDialog />
            <Link href="/contacts/imports">
              <Button variant="outline">
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </Link>
            <ExportContactsButton />
          </>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Contacts"
          value={formatNumber(total)}
          hint="All time"
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[18, 20, 19, 22, 21, 24, 23, total]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Subscribed"
          value={formatNumber(subscribed)}
          hint={`${formatPercent(subscribedPct)} of total`}
          icon={UserCheck}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[14, 15, 16, 15, 17, 18, 19, subscribed]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Unsubscribed"
          value={formatNumber(unsubscribed)}
          hint={`${formatPercent(unsubscribedPct)} of total`}
          icon={UserMinus}
          tone="bg-orange-50 text-orange-600"
          sparkline={[3, 2, 3, 2, 2, 3, 2, unsubscribed]}
          sparkColor="#f97316"
          href="/contacts/unsubscribed"
        />
        <MetricCard
          label="Invalid / Blocked"
          value={formatNumber(invalidBlocked)}
          hint={`${formatPercent(invalidBlockedPct)} of total`}
          icon={Ban}
          tone="bg-rose-50 text-rose-600"
          sparkline={[1, 2, 1, 2, 2, 1, 2, invalidBlocked]}
          sparkColor="#f43f5e"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            className="h-9 w-full min-w-[200px] rounded-[10px] border border-border bg-card px-3 text-[13px] outline-none focus:border-primary sm:max-w-sm"
            placeholder="Search by name, phone, or email..."
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" className="text-[13px]">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
              {statusLegend.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", item.dot)} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No contacts yet"
            description="Import contacts or add them manually to start building your audience."
            actionLabel="Import contacts"
            actionHref="/contacts/imports"
          />
        ) : (
          <>
            <Table className="text-[13px]">
              <THead>
                <TR>
                  <TH className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all contacts"
                      className="rounded border-border"
                    />
                  </TH>
                  <TH>Name</TH>
                  <TH>Phone</TH>
                  <TH>Email</TH>
                  <TH>Status</TH>
                  <TH>Lists</TH>
                  <TH>Tags</TH>
                  <TH>Consent Source</TH>
                  <TH>Consent Date</TH>
                  <TH>Last Messaged</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {contacts.map((contact, index) => (
                  <TR key={contact.id}>
                    <TD>
                      <input
                        type="checkbox"
                        aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                        className="rounded border-border"
                      />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            avatarTones[index % avatarTones.length],
                          )}
                        >
                          {getInitials(contact.firstName, contact.lastName)}
                        </span>
                        <div>
                          <Link
                            href={`/contacts/${contact.id}`}
                            className="font-semibold text-foreground hover:text-primary"
                          >
                            {contact.firstName} {contact.lastName}
                          </Link>
                          {contact.company ? (
                            <p className="text-[12px] text-muted-foreground">{contact.company}</p>
                          ) : null}
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">{formatPhone(contact.phone)}</TD>
                    <TD className="text-muted-foreground">{contact.email || "—"}</TD>
                    <TD>
                      <StatusChip status={contact.status} />
                    </TD>
                    <TD>
                      <div className="flex max-w-[140px] flex-wrap gap-1">
                        {contact.lists.length > 0 ? (
                          contact.lists.map((list) => (
                            <span
                              key={list}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
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
                      <div className="flex max-w-[140px] flex-wrap gap-1">
                        {contact.tags.length > 0 ? (
                          contact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
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
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatDate(contact.consentDate)}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatDate(contact.lastMessaged)}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <Link href={`/contacts/${contact.id}`}>
                          <Button variant="outline" size="sm" className="text-[12px]">
                            View
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">More actions</span>
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <PaginationBar rangeLabel={`1–${total} of ${total}`} />
          </>
        )}
      </Card>
    </div>
  );
}
