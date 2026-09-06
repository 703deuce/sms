"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Clock3,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppointmentsAnalyticsSection } from "@/lib/products/appointments-settings-tabs";

type AnalyticsData = {
  rangeDays: number;
  booked: number;
  completed?: number;
  confirmed: number;
  awaiting: number;
  canceled: number;
  noShow: number;
  rescheduleRequested: number;
  confirmationRate: number;
  cancellationRate?: number;
  noShowRate?: number;
  rescheduleRate?: number;
  remindersSent: number;
  remindersFailed: number;
  emailOpens?: number;
  emailClicks?: number;
  smsResponses?: number;
  utmConversions?: number;
  conversionRate?: number;
  popularTypes?: Array<{ name: string; count: number }>;
  popularTimes?: Array<{ hour: number; count: number }>;
  series: Array<{ date: string; count: number }>;
};

const RANGE_OPTIONS: Array<{ value: 7 | 30; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

function formatSeriesDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MetricSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="w-full space-y-2.5">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-7 w-14 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AppointmentsAnalyticsClient({
  section = "overview",
}: {
  section?: AppointmentsAnalyticsSection;
}) {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/appointments/analytics?range=${range}`)
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((json) => setData(json.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [range]);

  const cards = data
    ? [
        {
          label: "Booked",
          value: formatNumber(data.booked),
          icon: CalendarPlus,
          tone: "bg-primary/10 text-primary",
        },
        {
          label: "Confirmed",
          value: formatNumber(data.confirmed),
          icon: CheckCircle2,
          tone: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Awaiting",
          value: formatNumber(data.awaiting),
          icon: Clock3,
          tone: "bg-sky-50 text-sky-600",
        },
        {
          label: "Canceled",
          value: formatNumber(data.canceled),
          icon: CalendarX2,
          tone: "bg-rose-50 text-rose-600",
        },
        {
          label: "No-shows",
          value: formatNumber(data.noShow),
          icon: CalendarClock,
          tone: "bg-orange-50 text-orange-600",
        },
        {
          label: "Reschedule requests",
          value: formatNumber(data.rescheduleRequested),
          icon: RefreshCcw,
          tone: "bg-violet-50 text-violet-600",
        },
        {
          label: "Confirmation rate",
          value: `${data.confirmationRate}%`,
          icon: CalendarCheck2,
          tone: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Reminders sent",
          value: formatNumber(data.remindersSent),
          icon: Bell,
          tone: "bg-primary/10 text-primary",
        },
        {
          label: "Completed",
          value: formatNumber(data.completed ?? 0),
          icon: CalendarCheck2,
          tone: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Cancel rate",
          value: `${data.cancellationRate ?? 0}%`,
          icon: CalendarX2,
          tone: "bg-rose-50 text-rose-600",
        },
        {
          label: "No-show rate",
          value: `${data.noShowRate ?? 0}%`,
          icon: CalendarClock,
          tone: "bg-orange-50 text-orange-600",
        },
        {
          label: "Reschedule rate",
          value: `${data.rescheduleRate ?? 0}%`,
          icon: RefreshCcw,
          tone: "bg-violet-50 text-violet-600",
        },
        {
          label: "Email opens",
          value: formatNumber(data.emailOpens ?? 0),
          icon: Bell,
          tone: "bg-sky-50 text-sky-600",
        },
        {
          label: "UTM conversions",
          value: formatNumber(data.utmConversions ?? 0),
          icon: BarChart3,
          tone: "bg-primary/10 text-primary",
        },
      ]
    : [];

  const sectionTitles: Record<AppointmentsAnalyticsSection, { title: string; description: string }> = {
    overview: {
      title: "Overview",
      description: "High-level appointment operation performance.",
    },
    booking: {
      title: "Booking",
      description: "Booking volume, conversion, and popular booking patterns.",
    },
    reminders: {
      title: "Reminders",
      description: "Reminder delivery and customer response metrics.",
    },
    automations: {
      title: "Automations",
      description: "Workflow execution outcomes and automation performance.",
    },
    reports: {
      title: "Reports",
      description: "Exports and scheduled emailed reports.",
    },
  };

  const visibleCards = useMemo(() => {
    const bookingLabels = new Set([
      "Booked",
      "Completed",
      "Confirmation rate",
      "Cancel rate",
      "No-show rate",
      "Reschedule rate",
      "UTM conversions",
    ]);
    const reminderLabels = new Set([
      "Reminders sent",
      "Email opens",
    ]);
    const overviewLabels = new Set([
      "Booked",
      "Confirmed",
      "Awaiting",
      "Canceled",
      "No-shows",
      "Reschedule requests",
      "Confirmation rate",
      "Completed",
    ]);

    if (section === "booking") {
      return cards.filter((card) => bookingLabels.has(card.label));
    }
    if (section === "reminders") {
      return cards.filter((card) => reminderLabels.has(card.label));
    }
    if (section === "automations") {
      return cards.filter((card) => card.label === "UTM conversions");
    }
    if (section === "reports") {
      return [];
    }
    return cards.filter((card) => overviewLabels.has(card.label));
  }, [cards, section]);

  const showSeries = section === "overview" || section === "booking";
  const showPopular = section === "booking";
  const showReports = section === "reports" || section === "overview";
  const showReminderAlert = section === "overview" || section === "reminders";
  const heading = sectionTitles[section];
  const maxCount = data ? Math.max(1, ...data.series.map((row) => row.count)) : 1;
  const totalBookedInSeries = data
    ? data.series.reduce((sum, row) => sum + row.count, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {heading.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {heading.description} Last {range} days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Date range"
            className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-1"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={range === option.value}
                onClick={() => setRange(option.value)}
                className={cn(
                  "h-7 rounded-md px-3 text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  range === option.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <a
            href={`/api/appointments/analytics/export?format=csv&range=${range}`}
            className="inline-flex h-7 items-center rounded-md border border-border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-muted/50"
          >
            Export CSV
          </a>
          <a
            href={`/api/appointments/analytics/export?format=pdf&range=${range}`}
            className="inline-flex h-7 items-center rounded-md border border-border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-muted/50"
          >
            Export PDF
          </a>
        </div>
      </div>

      {loading ? (
        <MetricSkeleton />
      ) : error || !data ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Could not load analytics"
          description="Something went wrong while fetching your appointment metrics. Try again in a moment."
        />
      ) : data.booked === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title={`No appointments booked in the last ${range} days`}
          description="Once customers book online or you add appointments manually, metrics will appear here."
          actionLabel="View scheduled appointments"
          actionHref="/appointments"
        />
      ) : (
        <>
          {showReminderAlert && data.remindersFailed > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-amber-900">
                  {formatNumber(data.remindersFailed)} reminder{" "}
                  {data.remindersFailed === 1 ? "delivery" : "deliveries"} failed
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800/80">
                  Review failed reminder deliveries in this period —{" "}
                  <Link
                    href="/appointments"
                    className="font-semibold underline underline-offset-2 hover:text-amber-900"
                  >
                    check appointment timelines
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : null}

          {visibleCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleCards.map((card) => (
              <Card key={card.label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-1.5 font-display text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
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
              </Card>
            ))}
          </div>
          ) : null}

          {section === "automations" ? (
            <Card className="p-5">
              <CardTitle>Workflow activity</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Review execution logs and unknown customer replies.
              </p>
              <Link
                href="/appointments/automations/activity"
                className="mt-3 inline-flex text-[13px] font-semibold text-primary hover:underline"
              >
                Open automation activity
              </Link>
            </Card>
          ) : null}

          {showSeries ? (
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <CardTitle>Bookings by day</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatNumber(totalBookedInSeries)}{" "}
                  {totalBookedInSeries === 1 ? "booking" : "bookings"} in the last{" "}
                  {range} days
                </p>
              </div>
            </div>
            {data.series.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No bookings in this range.
              </p>
            ) : (
              <div className="mt-4 space-y-1.5">
                {data.series.map((row) => (
                  <div
                    key={row.date}
                    className="group flex items-center gap-3 rounded-md px-1 py-1 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="w-16 shrink-0 text-[13px] tabular-nums text-muted-foreground">
                      {formatSeriesDate(row.date)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{
                          width: `${Math.max(row.count > 0 ? 4 : 0, (row.count / maxCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-foreground">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          ) : null}

          {showPopular && data.popularTypes?.length ? (
            <Card className="p-5">
              <CardTitle>Popular appointment types</CardTitle>
              <ul className="mt-3 space-y-2">
                {data.popularTypes.slice(0, 8).map((t) => (
                  <li key={t.name} className="flex justify-between text-sm">
                    <span>{t.name}</span>
                    <span className="font-semibold tabular-nums">{t.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {showPopular && data.popularTimes?.length ? (
            <Card className="p-5">
              <CardTitle>Popular booking times</CardTitle>
              <ul className="mt-3 space-y-2">
                {data.popularTimes.slice(0, 8).map((t) => (
                  <li key={t.hour} className="flex justify-between text-sm">
                    <span>{t.hour === 0 ? "12 AM" : t.hour < 12 ? `${t.hour} AM` : t.hour === 12 ? "12 PM" : `${t.hour - 12} PM`}</span>
                    <span className="font-semibold tabular-nums">{t.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {showReports ? (
          <Card className="p-5">
            <CardTitle>Scheduled email reports</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Receive CSV/PDF summaries on a schedule.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                type="email"
                placeholder="reports@yourcompany.com"
                className="flex-1 min-w-[200px] rounded-md border px-3 py-2 text-sm"
                value={scheduleEmail}
                onChange={(e) => setScheduleEmail(e.target.value)}
              />
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                disabled={scheduling || !scheduleEmail}
                onClick={async () => {
                  setScheduling(true);
                  await fetch("/api/appointments/analytics/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: scheduleEmail, cadence: "weekly", rangeDays: range }),
                  });
                  setScheduling(false);
                }}
              >
                {scheduling ? "Scheduling…" : "Schedule weekly"}
              </button>
            </div>
          </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
