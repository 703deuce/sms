"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Pencil,
  Send,
  UserMinus,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { contacts } from "@/lib/mock/data";
import { cn, formatPhone } from "@/lib/utils";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contact = contacts.find((c) => c.id === params.id) ?? contacts[0];
  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName.charAt(0)}${contact.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-5 text-[13px]">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to contacts
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {initials}
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-foreground">
              {fullName}
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {contact.company ? `${contact.company} · ` : null}
              {formatPhone(contact.phone)}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusChip status={contact.status} />
              {contact.assignedUser ? (
                <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Assigned to {contact.assignedUser}
                </span>
              ) : null}
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Added {formatDate(contact.dateAdded)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-[10px]">
            <Pencil className="h-4 w-4" />
            Edit contact
          </Button>
          <div className="inline-flex overflow-hidden rounded-[10px]">
            <Button className="rounded-none rounded-l-[10px] pr-3">
              <Send className="h-4 w-4" />
              Send message
            </Button>
            <Button
              className="rounded-none rounded-r-[10px] border-l border-primary-foreground/20 px-2"
              aria-label="More send options"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Contact profile</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["Phone", formatPhone(contact.phone)],
                ["Email", contact.email || "—"],
                ["Consent source", contact.consentSource],
                ["Consent date", formatDate(contact.consentDate)],
                ["Last message sent", "Jul 2, 2026 · 9:14 AM"],
                ["Last message received", "Jul 2, 2026 · 9:16 AM"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 text-[13px] font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Consent history</h2>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Event</TH>
                    <TH>Source</TH>
                    <TH>Date</TH>
                    <TH>Detail</TH>
                  </TR>
                </THead>
                <TBody>
                  <TR>
                    <TD className="font-medium">Opt-in recorded</TD>
                    <TD className="text-muted-foreground">{contact.consentSource}</TD>
                    <TD className="text-muted-foreground">{formatDate(contact.consentDate)}</TD>
                    <TD className="text-muted-foreground">Express written consent captured</TD>
                  </TR>
                </TBody>
              </Table>
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 border-b border-border">
                <button
                  type="button"
                  className="border-b-2 border-primary pb-2.5 text-[13px] font-semibold text-primary"
                >
                  Conversation
                </button>
                <button
                  type="button"
                  className="pb-2.5 text-[13px] font-medium text-muted-foreground"
                >
                  Campaigns
                </button>
              </div>
              <Link href="/inbox">
                <Button variant="outline" className="h-9 rounded-[10px] text-[12px]">
                  Open in inbox
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex gap-3 rounded-[10px] border border-border bg-muted/40 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sky-100 text-sky-700">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Inbox conversation</p>
                  <p className="text-[12px] text-muted-foreground">
                    Jul 2, 2026 · Replied about Saturday appointment
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-[10px] border border-border bg-muted/40 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-emerald-100 text-emerald-700">
                  <Send className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Campaign message</p>
                  <p className="text-[12px] text-muted-foreground">
                    Jul 2, 2026 · July HVAC tune-up reminder
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Recent messages
              </p>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13px] text-primary-foreground">
                Harbor Home: Book your July tune-up and save 15% this week. Reply YES to schedule.
                <p className="mt-1 text-[11px] text-primary-foreground/75">Jul 2 · 9:14 AM</p>
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-[13px] text-foreground">
                Yes, Saturday morning works!
                <p className="mt-1 text-[11px] text-muted-foreground">Jul 2 · 9:16 AM</p>
              </div>
              <div className="rounded-[10px] border border-dashed border-border bg-muted/40 px-3.5 py-3 text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">Internal note · Jordan Lee</span>
                <p className="mt-1">
                  Customer prefers morning appointments. Follow up if no booking by Friday.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-[12px] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">Lists</h2>
              <button type="button" className="text-[12px] font-semibold text-primary hover:underline">
                Manage lists
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {contact.lists.length ? (
                contact.lists.map((list) => (
                  <span
                    key={list}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700"
                  >
                    {list}
                  </span>
                ))
              ) : (
                <p className="text-[12px] text-muted-foreground">No lists yet</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">Tags</h2>
              <button type="button" className="text-[12px] font-semibold text-primary hover:underline">
                Edit tags
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {contact.tags.length ? (
                contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[12px] font-medium",
                      tag === "hot-lead"
                        ? "bg-orange-50 text-orange-700"
                        : tag === "risk"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <p className="text-[12px] text-muted-foreground">No tags yet</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Quick actions</h2>
            <div className="mt-3 space-y-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-foreground hover:bg-muted/60"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Edit contact
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-foreground hover:bg-muted/60"
              >
                <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                Unsubscribe
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50"
              >
                <UserMinus className="h-3.5 w-3.5" />
                Block contact
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
