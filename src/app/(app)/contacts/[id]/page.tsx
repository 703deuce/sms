import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getActiveWorkspaceId } from "@/lib/auth";
import type { Contact, Conversation } from "@/lib/types";
import { loadContactById, loadConversations } from "@/lib/workspace-data";
import { formatPhone } from "@/lib/utils";
import { ContactAppointmentsPanel } from "@/components/appointments/contact-appointments-panel";
import { ClickToCallButton } from "@/components/contacts/click-to-call-button";
import { ContactActivityTimeline } from "@/components/contacts/contact-activity-timeline";
import { ConnectedRecordsPanel } from "@/components/contacts/connected-records-panel";
import { IntegrationTimelineCard } from "@/components/contacts/integration-timeline-card";
import {
  ArrowLeft,
  Inbox,
  MessageSquare,
  Shield,
  Tag,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function consentHistoryFor(contact: Contact) {
  const events = [];

  if (contact.consentDate) {
    events.push({
      id: "ch_1",
      event: "Opt-in recorded",
      source: contact.consentSource,
      at: contact.consentDate,
      detail: "Initial consent captured",
    });
  }

  if (contact.status === "Unsubscribed") {
    events.push({
      id: "ch_2",
      event: "Unsubscribed",
      source: "STOP keyword",
      at: contact.lastReply ?? contact.lastMessaged ?? contact.consentDate,
      detail: "Contact opted out",
    });
  }

  if (contact.status === "Blocked") {
    events.push({
      id: "ch_3",
      event: "Blocked",
      source: "Manual",
      at: contact.dateAdded,
      detail: "Blocked by workspace admin",
    });
  }

  if (contact.status === "Invalid") {
    events.push({
      id: "ch_4",
      event: "Marked invalid",
      source: "Carrier lookup",
      at: contact.dateAdded,
      detail: "Number classified as landline or unreachable",
    });
  }

  return events;
}

function initialsOf(contact: Contact) {
  const first = contact.firstName?.trim()?.[0] || "";
  const last = contact.lastName?.trim()?.[0] || "";
  return (first + last).toUpperCase() || contact.phone.slice(-2);
}

function ProfileField({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          strong
            ? "mt-1 truncate text-sm font-medium text-foreground"
            : "mt-1 truncate text-sm text-foreground/80"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function InlineEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <p className="text-[13px] text-muted-foreground">{children}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/contacts"
      className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to contacts
    </Link>
  );
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Contact" description="Contact details" />
        <EmptyState
          title="No workspace selected"
          description="Select or create a workspace to view this contact."
        />
      </div>
    );
  }

  const contact = await loadContactById(workspaceId, id);

  if (!contact) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col justify-center py-8">
        <BackLink />
        <EmptyState
          icon={<UserX className="h-5 w-5" />}
          title="Contact not found"
          description="This contact may have been deleted, or it belongs to a different workspace. Head back to your contacts list to keep working."
          actionLabel="Back to contacts"
          actionHref="/contacts"
        />
      </div>
    );
  }

  const conversations = await loadConversations(workspaceId, {
    product: "all",
    contactId: contact.id,
  });
  const conversation = conversations[0] ?? null;
  const consentHistory = consentHistoryFor(contact);

  return (
    <div>
      <div className="mb-5">
        <BackLink />

        <div className="surface flex flex-col gap-4 rounded-xl bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-base font-semibold text-primary ring-1 ring-inset ring-primary/15">
              {initialsOf(contact)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground">
                  {contact.firstName} {contact.lastName}
                </h1>
                <StatusChip status={contact.status} />
              </div>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">
                {contact.company ? `${contact.company} · ` : ""}
                <span className="tabular-nums">{formatPhone(contact.phone)}</span>
                {contact.assignedUser ? ` · Assigned to ${contact.assignedUser}` : ""}
                {" · Added "}
                {formatDate(contact.dateAdded)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ClickToCallButton phone={contact.phone} />
            {contact.status === "Subscribed" ? (
              <Link href="/send/quick">
                <Button size="sm">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Send message
                </Button>
              </Link>
            ) : (
              <Button size="sm" disabled>
                <MessageSquare className="h-3.5 w-3.5" />
                Send message
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardTitle>Contact profile</CardTitle>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label="Phone" value={formatPhone(contact.phone)} strong />
              <ProfileField label="Email" value={contact.email || "—"} strong />
              <ProfileField label="Company" value={contact.company || "—"} />
              <ProfileField label="Consent source" value={contact.consentSource || "—"} />
              <ProfileField label="Consent date" value={formatDate(contact.consentDate)} />
              <ProfileField label="Last messaged" value={formatDate(contact.lastMessaged)} />
              <ProfileField label="Last reply" value={formatDate(contact.lastReply)} />
            </dl>
          </Card>

          <Card>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Consent history
            </CardTitle>
            {consentHistory.length > 0 ? (
              <Table className="mt-4">
                <THead>
                  <TR>
                    <TH>Event</TH>
                    <TH>Source</TH>
                    <TH>Date</TH>
                    <TH>Detail</TH>
                  </TR>
                </THead>
                <TBody>
                  {consentHistory.map((event) => (
                    <TR key={event.id}>
                      <TD className="font-medium text-foreground">{event.event}</TD>
                      <TD>{event.source}</TD>
                      <TD className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatDate(event.at)}
                      </TD>
                      <TD className="text-muted-foreground">{event.detail}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <InlineEmpty>No consent events recorded.</InlineEmpty>
            )}
          </Card>

          <Card>
            <CardTitle>Activity</CardTitle>
            <CardDescription>
              Unified timeline of SMS, softphone calls, AI voice, and voicemail.
            </CardDescription>
            {conversation ? (
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Inbox className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-medium text-foreground">Open inbox thread</p>
                  <StatusChip status={conversation.status} />
                </div>
                <Link href={`/conversations?conversation=${encodeURIComponent(conversation.id)}`}>
                  <Button variant="outline" size="sm">
                    Open in inbox
                  </Button>
                </Link>
              </div>
            ) : contact.status === "Subscribed" ? (
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-3.5 py-2.5">
                <p className="text-sm text-muted-foreground">No inbox thread yet for this contact.</p>
                <Link href={`/conversations?contactId=${encodeURIComponent(contact.id)}`}>
                  <Button variant="outline" size="sm">
                    <Inbox className="h-3.5 w-3.5" />
                    Start conversation
                  </Button>
                </Link>
              </div>
            ) : null}
            <ContactActivityTimeline contactId={contact.id} />
          </Card>

          <Card>
            <CardTitle>Appointments</CardTitle>
            <CardDescription>
              Upcoming and past bookings for this contact.
            </CardDescription>
            <div className="mt-4">
              <ContactAppointmentsPanel contactId={contact.id} />
            </div>
          </Card>

          <Card>
            <CardTitle>Integration timeline</CardTitle>
            <CardDescription>
              CRM webhook events and mapping sync activity from Salesforce, Zoho, Pipedrive, and Calendly.
            </CardDescription>
            <IntegrationTimelineCard contactId={contact.id} />
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardTitle>Connected records</CardTitle>
            <CardDescription>
              Salesforce, Zoho, Pipedrive, and Calendly records linked to this contact.
            </CardDescription>
            <div className="mt-4">
              <ConnectedRecordsPanel contactId={contact.id} />
            </div>
            <Link
              href="/integrations/crm"
              className="mt-4 inline-block text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Manage CRM integrations
            </Link>
          </Card>

          <Card>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Lists
            </CardTitle>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {contact.lists.length > 0 ? (
                contact.lists.map((list) => (
                  <Link
                    key={list}
                    href="/contacts/lists"
                    className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    {list}
                  </Link>
                ))
              ) : (
                <p className="text-[13px] text-muted-foreground">Not on any lists</p>
              )}
            </div>
            <Link href="/contacts/lists">
              <Button variant="outline" size="sm" className="mt-4 w-full">
                Manage lists
              </Button>
            </Link>
          </Card>

          <Card>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Tags
            </CardTitle>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {contact.tags.length > 0 ? (
                contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <p className="text-[13px] text-muted-foreground">No tags applied</p>
              )}
            </div>
            <Link href="/contacts/tags">
              <Button variant="outline" size="sm" className="mt-4 w-full">
                Manage tags
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
