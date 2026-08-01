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
import { ClickToCallButton } from "@/components/contacts/click-to-call-button";
import { ContactActivityTimeline } from "@/components/contacts/contact-activity-timeline";
import { ContactIntegrationsPanel } from "@/components/contacts/contact-integrations-panel";
import { ArrowLeft, MessageSquare, Shield } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
    notFound();
  }

  const conversations: Conversation[] = await loadConversations(workspaceId);
  const conversation = conversations.find(
    (c: Conversation) => c.contactId === contact.id,
  );
  const consentHistory = consentHistoryFor(contact);

  return (
    <div>
      <PageHeader
        title={`${contact.firstName} ${contact.lastName}`}
        description={
          contact.company
            ? `${contact.company} · ${formatPhone(contact.phone)}`
            : formatPhone(contact.phone)
        }
        actions={
          <>
            <Link href="/contacts">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <ClickToCallButton phone={contact.phone} />
            {contact.status === "Subscribed" ? (
              <Link href="/send/quick">
                <Button>
                  <MessageSquare className="h-4 w-4" />
                  Send message
                </Button>
              </Link>
            ) : (
              <Button disabled>Send message</Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChip status={contact.status} />
        {contact.assignedUser ? (
          <span className="text-sm text-muted-foreground">Assigned to {contact.assignedUser}</span>
        ) : null}
        <span className="text-sm text-muted-foreground">Added {formatDate(contact.dateAdded)}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Contact profile</CardTitle>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</dt>
                <dd className="mt-1 font-medium">{formatPhone(contact.phone)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
                <dd className="mt-1 font-medium">{contact.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consent source</dt>
                <dd className="mt-1">{contact.consentSource}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consent date</dt>
                <dd className="mt-1">{formatDate(contact.consentDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last messaged</dt>
                <dd className="mt-1">{formatDate(contact.lastMessaged)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last reply</dt>
                <dd className="mt-1">{formatDate(contact.lastReply)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Consent history
              </CardTitle>
            </div>
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
                      <TD className="font-medium">{event.event}</TD>
                      <TD>{event.source}</TD>
                      <TD className="text-muted-foreground">{formatDate(event.at)}</TD>
                      <TD className="text-muted-foreground">{event.detail}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No consent events recorded.</p>
            )}
          </Card>

          <Card>
            <CardTitle>Activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Unified timeline of SMS, softphone calls, AI voice, and voicemail.
            </p>
            {conversation ? (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Open inbox thread</p>
                  <StatusChip status={conversation.status} />
                </div>
                <Link href="/inbox" className="mt-2 inline-block">
                  <Button variant="outline" size="sm">
                    Open in inbox
                  </Button>
                </Link>
              </div>
            ) : null}
            <ContactActivityTimeline contactId={contact.id} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Connected apps</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              External records from native integrations and CRM.
            </p>
            <div className="mt-4">
              <ContactIntegrationsPanel contactId={contact.id} />
            </div>
            <Link
              href="/integrations/native"
              className="mt-4 inline-block text-sm underline text-muted-foreground"
            >
              Manage integrations
            </Link>
          </Card>

          <Card>
            <CardTitle>Lists</CardTitle>
            <div className="mt-4 flex flex-wrap gap-2">
              {contact.lists.length > 0 ? (
                contact.lists.map((list) => (
                  <Link
                    key={list}
                    href="/contacts/lists"
                    className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    {list}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Not on any lists</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-full">
              Manage lists
            </Button>
          </Card>

          <Card>
            <CardTitle>Tags</CardTitle>
            <div className="mt-4 flex flex-wrap gap-2">
              {contact.tags.length > 0 ? (
                contact.tags.map((tag) => (
                  <Link
                    key={tag}
                    href="/contacts/tags"
                    className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/20"
                  >
                    {tag}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No tags applied</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-full">
              Edit tags
            </Button>
          </Card>

          <Card>
            <CardTitle>Quick actions</CardTitle>
            <div className="mt-4 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                Edit contact
              </Button>
              {contact.status === "Subscribed" ? (
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Unsubscribe
                </Button>
              ) : null}
              {contact.status !== "Blocked" ? (
                <Button variant="outline" size="sm" className="w-full justify-start text-danger">
                  Block contact
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Unblock contact
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
