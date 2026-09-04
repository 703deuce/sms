"use client";

import { formatAppointmentTime } from "@/components/appointments/appointment-ui";
import { OverviewBookingsChart } from "@/components/appointments/overview/bookings-chart";
import { OverviewNeedsAttention } from "@/components/appointments/overview/needs-attention";
import { OverviewQuickActions } from "@/components/appointments/overview/quick-actions";
import { OverviewRecentConversations } from "@/components/appointments/overview/recent-conversations";
import { OverviewStatCards, type OverviewStatCard } from "@/components/appointments/overview/stat-cards";
import { OverviewTodaySchedule } from "@/components/appointments/overview/today-schedule";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./overview/overview.css";

type OverviewData = {
  counts: {
    todayTotal: number;
    confirmed: number;
    awaitingConfirmation: number;
    rescheduleRequested: number;
    unreadConversations: number;
    reminderFailed?: number;
  };
  todayAppointments: Array<{
    id: string;
    inviteeName: string | null;
    serviceName: string | null;
    startsAt: string;
    status: string;
    timezone: string | null;
  }>;
  upcomingAppointments?: Array<{
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

type AnalyticsData = {
  booked: number;
  confirmationRate: number;
  remindersSent: number;
  remindersFailed: number;
  series: Array<{ date: string; count: number }>;
};

function OverviewSkeleton() {
  return (
    <div className="appt-overview animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="appt-overview__card h-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="appt-overview__card h-80" />
        <div className="appt-overview__card h-80" />
      </div>
    </div>
  );
}

function formatTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildStatCards(data: OverviewData, analytics: AnalyticsData | null): OverviewStatCard[] {
  const upcoming = data.upcomingAppointments ?? [];
  const nextAppt = upcoming[0];
  const confirmationRate = analytics?.confirmationRate ?? 0;
  const remindersSent = analytics?.remindersSent ?? 0;
  const remindersFailed = analytics?.remindersFailed ?? data.counts.reminderFailed ?? 0;
  const reminderHealth =
    remindersSent > 0
      ? Math.round(((remindersSent - remindersFailed) / remindersSent) * 100)
      : remindersFailed > 0
        ? 0
        : 100;

  return [
    {
      id: "upcoming",
      label: "Upcoming appointments",
      value: String(upcoming.length > 0 ? upcoming.length : data.counts.todayTotal),
      sub: nextAppt
        ? `Next: ${formatAppointmentTime(nextAppt.startsAt, nextAppt.timezone)}`
        : "No upcoming appointments",
      icon: "calendar",
      tone: "violet",
    },
    {
      id: "confirmation",
      label: "Confirmation rate",
      value: `${confirmationRate}%`,
      sub: analytics ? "Last 7 days" : "Loading analytics…",
      subTone: confirmationRate >= 80 ? "green" : undefined,
      icon: "check",
      tone: "green",
    },
    {
      id: "reminders",
      label: "Reminders sent",
      value: String(remindersSent),
      sub: "Last 7 days",
      icon: "send",
      tone: "blue",
    },
    {
      id: "health",
      label: "Reminder health",
      value: `${reminderHealth}%`,
      sub: reminderHealth >= 95 ? "Excellent" : remindersFailed > 0 ? `${remindersFailed} failed` : "Good",
      subTone: reminderHealth >= 95 ? "green" : undefined,
      icon: "shield",
      tone: "amber",
    },
  ];
}

function buildChartData(analytics: AnalyticsData | null) {
  if (!analytics?.series?.length) {
    return {
      total: 0,
      deltaLabel: "No bookings yet",
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      values: [0, 0, 0, 0, 0, 0, 0],
      peakLabel: "—",
      vsLastWeek: "—",
    };
  }

  const values = analytics.series.map((s) => s.count);
  const days = analytics.series.map((s) =>
    new Date(`${s.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
  );
  const peak = analytics.series.reduce((best, row) => (row.count > best.count ? row : best), analytics.series[0]);
  const peakDate = new Date(`${peak.date}T00:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

  return {
    total: analytics.booked,
    deltaLabel: `${analytics.booked} total booked`,
    days,
    values,
    peakLabel: `${peakDate} (${peak.count} appointments)`,
    vsLastWeek: analytics.booked > 0 ? "↑ this week" : "—",
  };
}

export function AppointmentsOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      fetch("/api/appointments/overview").then((r) => {
        if (!r.ok) throw new Error("overview failed");
        return r.json();
      }),
      fetch("/api/appointments/analytics?range=7").then((r) => (r.ok ? r.json() : { data: null })),
      fetch("/api/appointments/settings").then((r) => (r.ok ? r.json() : { workspace: null })),
    ])
      .then(([overviewJson, analyticsJson, settingsJson]) => {
        setData(overviewJson.data);
        setAnalytics(analyticsJson.data ?? null);
        setWorkspaceSlug(settingsJson.workspace?.slug ?? null);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const bookingUrl = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${workspaceSlug}`;
  }, [workspaceSlug]);

  const statCards = useMemo(
    () => (data ? buildStatCards(data, analytics) : []),
    [data, analytics],
  );
  const chartData = useMemo(() => buildChartData(analytics), [analytics]);

  const copyBookingLink = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (loading) return <OverviewSkeleton />;

  if (failed || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="font-display text-sm font-semibold text-foreground">We couldn&apos;t load your overview</h3>
        <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">
          Something went wrong while fetching today&apos;s appointments and conversations.
        </p>
        <Button size="sm" className="mt-5" onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="appt-overview space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-bold tracking-tight text-foreground">
            Overview <span aria-hidden>👋</span>
          </h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            Here&apos;s what&apos;s happening with your appointments today.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-medium text-foreground shadow-sm"
        >
          <Calendar size={15} className="text-muted-foreground" />
          {formatTodayLabel()}
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </div>

      <OverviewStatCards cards={statCards} />

      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewTodaySchedule
          appointments={data.todayAppointments}
          totalCount={data.counts.todayTotal}
        />
        <OverviewBookingsChart data={chartData} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <OverviewRecentConversations rows={data.recentConversations ?? []} />
        <OverviewNeedsAttention items={data.needsAttention} />
        <OverviewQuickActions
          bookingUrl={bookingUrl}
          onCopyBookingLink={copyBookingLink}
          copied={copied}
        />
      </div>
    </div>
  );
}
