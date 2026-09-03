"use client";

import { AppointmentStatusBadge, formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export function AppointmentsOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/appointments/overview")
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading overview…</p>;
  if (!data) return <p className="text-sm text-rose-600">Could not load overview.</p>;

  const cards = [
    { label: "Appointments Today", value: data.counts.todayTotal },
    { label: "Confirmed", value: data.counts.confirmed },
    { label: "Awaiting Confirmation", value: data.counts.awaitingConfirmation },
    { label: "Reschedule Requests", value: data.counts.rescheduleRequested },
    { label: "Unread Conversations", value: data.counts.unreadConversations, href: "/conversations?unread=1" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          What is happening with your appointments and customer conversations today?
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-xl border-slate-200 p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            {"href" in card && card.href ? (
              <Link href={card.href} className="mt-2 block text-3xl font-semibold text-slate-900 no-underline hover:text-sky-700">
                {card.value}
              </Link>
            ) : (
              <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Today&apos;s Appointments</h2>
            <Link href="/appointments/calendar">
              <Button variant="outline" size="sm">
                Open calendar
              </Button>
            </Link>
          </div>
          {data.todayAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">No appointments scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {data.todayAppointments.map((appt) => (
                <Link
                  key={appt.id}
                  href={`/appointments/${appt.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 no-underline hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {appt.inviteeName || "Customer"} · {appt.serviceName || "Appointment"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatAppointmentWhen(appt.startsAt, appt.timezone)}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={appt.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Needs Attention</h2>
          {data.needsAttention.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing urgent right now.</p>
          ) : (
            <div className="space-y-2">
              {data.needsAttention.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm text-amber-900 no-underline hover:bg-amber-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {data.recentConversations && data.recentConversations.length > 0 ? (
        <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Conversations</h2>
            <Link href="/conversations">
              <Button variant="outline" size="sm">
                Open inbox
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {data.recentConversations.map((c) => (
              <Link
                key={c.id}
                href={`/conversations?conversationId=${c.id}`}
                className="block rounded-lg border border-slate-100 px-3 py-2 no-underline hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  {c.unread ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                      Unread
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs text-slate-500">{c.preview || "No messages yet"}</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/appointments/new">
          <Button>New Appointment</Button>
        </Link>
        <Link href="/appointments/types">
          <Button variant="outline">Appointment Types</Button>
        </Link>
        <Link href="/appointments/booking">
          <Button variant="outline">Booking Page</Button>
        </Link>
      </div>
    </div>
  );
}
