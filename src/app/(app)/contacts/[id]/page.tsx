import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getActiveWorkspaceId } from "@/lib/auth";
import type { Contact, Conversation } from "@/lib/types";
import { loadContactById, loadConversations } from "@/lib/workspace-data";
import { cn, formatPhone } from "@/lib/utils";
import { ContactAppointmentsPanel } from "@/components/appointments/contact-appointments-panel";
import { ContactBookingActions } from "@/components/contacts/contact-booking-actions";
import { ContactProfileEdit } from "@/components/contacts/contact-profile-edit";
import { ClickToCallButton } from "@/components/contacts/click-to-call-button";
import { ContactActivityTimeline } from "@/components/contacts/contact-activity-timeline";
import { ConnectedRecordsPanel } from "@/components/contacts/connected-records-panel";
import { IntegrationTimelineCard } from "@/components/contacts/integration-timeline-card";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Inbox,
  ListChecks,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  Tag,
  UserX,
  Users,
  Workflow,
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
  mono,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  mono?: boolean;
}) {
  const empty = value === "—" || value == null || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate text-sm",
          mono && "tabular-nums",
          empty
            ? "text-muted-foreground/70"
            : strong
              ? "font-medium text-foreground"
              : "text-foreground/80",
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3.5">
      <div className="min-w-0">
        <CardTitle className="flex items-center gap-2">
          {icon ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">
              {icon}
            </span>
          ) : null}
          {title}
        </CardTitle>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
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

  const fullName =
    `${contact.firstName} ${contact.lastName}`.trim() || formatPhone(contact.phone);

  return (
    <div>
      <div className="mb-5">
        <BackLink />

        {/* Identity header */}
        <div className="surface flex flex-col gap-4 rounded-xl bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-base font-semibold text-primary ring-1 ring-inset ring-primary/20">
              {initialsOf(contact)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground">
                  {fullName}
                </h1>
                <StatusChip status={contact.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                  {formatPhone(contact.phone)}
                </span>
                {contact.company ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                    {contact.company}
                  </span>
                ) : null}
                {contact.assignedUser ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
                    {contact.assignedUser}
                  </span>
                ) : null}
                <span className="text-muted-foreground/70">
                  Added {formatDate(contact.dateAdded)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ContactBookingActions
              contactId={contact.id}
              phone={contact.phone}
              email={contact.email}
              firstName={contact.firstName}
              lastName={contact.lastName}
            />
            <ClickToCallButton phone={contact.phone} />
            {contact.status === "Subscribed" ? (
              <Link href="/send/quick">
                <Button size="sm">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Send message
                </Button>
              </Link>
            ) : (
              <Button size="sm" disabled title="Contact is not subscribed">
                <MessageSquare className="h-3.5 w-3.5" />
                Send message
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="Contact profile" />
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label="Phone" value={formatPhone(contact.phone)} strong mono />
              <ProfileField label="Email" value={contact.email || "—"} strong />
              <ProfileField label="Company" value={contact.company || "—"} />
              <ProfileField label="Consent source" value={contact.consentSource || "—"} />
              <ProfileField label="Consent date" value={formatDate(contact.consentDate)} />
              <ProfileField label="Last messaged" value={formatDate(contact.lastMessaged)} />
              <ProfileField label="Last reply" value={formatDate(contact.lastReply)} />
              <ProfileField
                label="Timezone"
                value={contact.timezone || "—"}
              />
              <ProfileField
                label="LinkedIn"
                value={
                  (contact.customFields as { linkedin?: string } | null)?.linkedin || "—"
                }
              />
            </dl>
          </Card>

          <Card>
            <SectionHeader
              icon={<CalendarClock className="h-4 w-4" />}
              title="Appointments"
              description="Upcoming and past bookings for this contact."
            />
            <div className="mt-4">
              <ContactAppointmentsPanel contactId={contact.id} />

          <ContactProfileEdit
            contactId={contact.id}
            timezone={contact.timezone}
            linkedin={(contact.customFields as { linkedin?: string } | null)?.linkedin}
          />
            </div>
          </Card>

          <Card>
            <SectionHeader
              icon={<Shield className="h-4 w-4" />}
              title="Consent history"
              description="Opt-in, opt-out, and deliverability events for this contact."
            />
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
            <SectionHeader
              icon={<MessageSquare className="h-4 w-4" />}
              title="Activity"
              description="Unified timeline of SMS, softphone calls, AI voice, and voicemail."
            />
            {conversation ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-3.5 py-2.5">
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
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ) : contact.status === "Subscribed" ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-3.5 py-2.5">
                <p className="text-sm text-muted-foreground">
                  No inbox thread yet for this contact.
                </p>
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
        </div>

        {/* Sidebar column */}
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHeader
              icon={<Workflow className="h-4 w-4" />}
              title="Connected records"
              description="Salesforce, Zoho, Pipedrive, and Calendly records linked to this contact."
            />
            <div className="mt-4">
              <ConnectedRecordsPanel contactId={contact.id} compact />
            </div>
            <Link
              href="/settings/integrations"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Manage CRM integrations
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card>
            <SectionHeader
              icon={<ListChecks className="h-4 w-4" />}
              title="Lists"
              action={
                <Link href="/contacts/lists">
                  <Button variant="outline" size="sm">
                    Manage lists
                  </Button>
                </Link>
              }
            />
            {contact.lists.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {contact.lists.map((list) => (
                  <span
                    key={list}
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-border/60"
                  >
                    {list}
                  </span>
                ))}
              </div>
            ) : (
              <InlineEmpty>This contact is not in any lists.</InlineEmpty>
            )}
          </Card>

          <Card>
            <SectionHeader
              icon={<Tag className="h-4 w-4" />}
              title="Tags"
              action={
                <Link href="/contacts">
                  <Button variant="outline" size="sm">
                    Manage tags
                  </Button>
                </Link>
              }
            />
            {contact.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/[0.06] px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <InlineEmpty>No tags applied.</InlineEmpty>
            )}
          </Card>

          <Card>
            <SectionHeader
              icon={<Mail className="h-4 w-4" />}
              title="Integration activity"
              description="CRM sync and calendar events for this contact."
            />
            <IntegrationTimelineCard contactId={contact.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
