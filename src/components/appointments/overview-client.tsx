"use client";

import {
  AppointmentStatusBadge,
  formatAppointmentTime,
  formatAppointmentWhen,
} from "@/components/appointments/appointment-ui";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Inbox,
  MessageSquare,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type OverviewData = {
  counts: {
    todayTotal: number;
    confirmed: number;
    awaitingConfirmation: number;
    rescheduleRequested: number;
    unreadConversations: number;
  };
  todayAppointments: Array<{
    id: string;
    inviteeName: string | null;
    serviceName: string | null;
    startsAt: string;
    status: string;
    timezone: string | null;
  }>;
  needsAttention: Array<{ id: string; kind: string; label: string; href: string }>;
  recentConversations?: Array<{
    id: string;
    name: string;
    preview: string;
    updatedAt: string;
    unread: boolean;
  }>;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function OverviewSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-md bg-muted" />
        <div className="h-4 w-80 rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="surface rounded-xl bg-card p-4">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-3 h-7 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="surface rounded-xl bg-card p-5">
            <div className="h-4 w-44 rounded bg-muted" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-14 rounded-lg bg-muted/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppointmentsOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    fetch("/api/appointments/overview")
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((json) => setData(json.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <OverviewSkeleton />;

  if (failed || !data) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="We couldn't load your overview"
        description="Something went wrong while fetching today's appointments and conversations. Please try again."
      />
    );
  }

  const attentionTotal =
    data.counts.awaitingConfirmation +
    data.counts.rescheduleRequested +
    data.counts.unreadConversations;

  const cards = [
    {
      label: "Appointments today",
      value: data.counts.todayTotal,
      icon: CalendarDays,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "Confirmed",
      value: data.counts.confirmed,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Awaiting confirmation",
      value: data.counts.awaitingConfirmation,
      icon: CalendarClock,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Reschedule requests",
      value: data.counts.rescheduleRequested,
      icon: RotateCcw,
      tone: "bg-orange-50 text-orange-600",
    },
    {
      label: "Unread conversations",
      value: data.counts.unreadConversations,
      icon: MessageSquare,
      tone: "bg-violet-50 text-violet-600",
      href: "/conversations?unread=1",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Today&apos;s appointments, confirmations, and conversations at a glance.
          </p>
        </div>
        <Link href="/appointments/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New appointment
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const body = (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 font-display text-[26px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
                  {card.value}
                </p>
              </div>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  card.tone,
                )}
              >
                <card.icon className="h-[18px] w-[18px]" />
              </span>
            </div>
          );

          if (card.href) {
            return (
              <Link
                key={card.label}
                href={card.href}
                className="surface block rounded-xl bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
              >
                {body}
              </Link>
            );
          }
          return (
            <Card key={card.label} className="p-4">
              {body}
            </Card>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid items-start gap-6 xl:grid-cols-5">
        {/* Today's appointments */}
        <Card className="p-0 xl:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <CardTitle>Today&apos;s appointments</CardTitle>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {data.todayAppointments.length}
              </span>
            </div>
            <Link href="/appointments/calendar">
              <Button variant="ghost" size="sm" className="gap-1">
                Open calendar
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {data.todayAppointments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CalendarCheck className="h-5 w-5" />}
                title="No appointments today"
                description="Your schedule is clear for today. New bookings will appear here as they come in."
                actionLabel="New appointment"
                actionHref="/appointments/new"
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {data.todayAppointments.map((appt) => (
                <li key={appt.id}>
                  <Link
                    href={`/appointments/${appt.id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="w-14 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatAppointmentTime(appt.startsAt, appt.timezone)}
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-semibold text-primary">
                      {initials(appt.inviteeName || "C")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {appt.inviteeName || "Customer"}
                      </p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {appt.serviceName || "Appointment"}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appt.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Needs attention */}
        <Card className="p-0 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <CardTitle>Needs attention</CardTitle>
            {attentionTotal > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800">
                {attentionTotal}
              </span>
            ) : null}
          </div>
          {data.needsAttention.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Nothing needs your attention right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {data.needsAttention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {item.label}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent conversations */}
      {data.recentConversations && data.recentConversations.length > 0 ? (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <CardTitle>Recent conversations</CardTitle>
            <Link href="/conversations">
              <Button variant="ghost" size="sm" className="gap-1">
                <Inbox className="h-3.5 w-3.5" />
                Open inbox
              </Button>
            </Link>
          </div>
          <ul className="divide-y divide-border/70">
            {data.recentConversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/conversations?conversationId=${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-foreground/80">
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm text-foreground",
                          c.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {c.name}
                      </span>
                      {c.unread ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "block truncate text-[13px]",
                        c.unread
                          ? "text-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {c.preview || "No messages yet"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {formatAppointmentWhen(c.updatedAt).split(",")[0]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick actions
        </span>
        <Link href="/appointments/types">
          <Button variant="outline" size="sm">
            Appointment types
          </Button>
        </Link>
        <Link href="/appointments/booking">
          <Button variant="outline" size="sm">
            Booking page
          </Button>
        </Link>
        <Link href="/appointments/calendar">
          <Button variant="ghost" size="sm">
            View calendar
          </Button>
        </Link>
      </div>
    </div>
  );
}
