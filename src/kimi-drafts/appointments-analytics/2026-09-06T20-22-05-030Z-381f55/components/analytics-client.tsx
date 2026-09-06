"use client";

import { useEffect, useMemo, useState } from "react";
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
  Download,
  RefreshCcw,
  Reply,
  MousePointerClick,
  Inbox,
  Workflow,
  FileBarChart2,
} from "lucide-react";
import {
  AnalyticsSection,
  getAnalytics,
  sectionMeta,
  type AnalyticsData,
} from "../mock-data";
import { Button, Card, CardTitle, EmptyState, cn, formatNumber } from "./ui";
import { MetricCard, MetricSkeletonGrid, type MetricDef } from "./metric-card";
import { BookingsChart } from "./bookings-chart";
import { PopularTimes, PopularTypes } from "./popular-panel";
import { ScheduleReportCard } from "./schedule-report-card";

const RANGE_OPTIONS: Array<{ value: 7 | 30; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

type LoadState = "loading" | "ready" | "error" | "empty";

function buildMetrics(data: AnalyticsData): MetricDef[] {
  return [
    { label: "Booked", value: formatNumber(data.booked), icon: CalendarPlus, tone: "bg-indigo-50 text-primary" },
    { label: "Confirmed", value: formatNumber(data.confirmed), icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Awaiting", value: formatNumber(data.awaiting), icon: Clock3, tone: "bg-sky-50 text-sky-600" },
    { label: "Canceled", value: formatNumber(data.canceled), icon: CalendarX2, tone: "bg-rose-50 text-rose-600" },
    { label: "No-shows", value: formatNumber(data.noShow), icon: CalendarClock, tone: "bg-orange-50 text-orange-600" },
    { label: "Reschedule requests", value: formatNumber(data.rescheduleRequested), icon: RefreshCcw, tone: "bg-violet-50 text-violet-600" },
    { label: "Confirmation rate", value: `${data.confirmationRate}%`, icon: CalendarCheck2, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Reminders sent", value: formatNumber(data.remindersSent), icon: Bell, tone: "bg-indigo-50 text-primary" },
    { label: "Completed", value: formatNumber(data.completed), icon: CalendarCheck2, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Cancel rate", value: `${data.cancellationRate}%`, icon: CalendarX2, tone: "bg-rose-50 text-rose-600" },
    { label: "No-show rate", value: `${data.noShowRate}%`, icon: CalendarClock, tone: "bg-orange-50 text-orange-600" },
    { label: "Reschedule rate", value: `${data.rescheduleRate}%`, icon: RefreshCcw, tone: "bg-violet-50 text-violet-600" },
    { label: "Email opens", value: formatNumber(data.emailOpens), icon: Inbox, tone: "bg-sky-50 text-sky-600" },
    { label: "UTM conversions", value: formatNumber(data.utmConversions), icon: BarChart3, tone: "bg-indigo-50 text-primary" },
  ];
}

const SECTION_METRICS: Record<AnalyticsSection, string[]> = {
  overview: [
    "Booked", "Confirmed", "Awaiting", "Canceled",
    "No-shows", "Reschedule requests", "Confirmation rate", "Reminders sent",
  ],
  booking: [
    "Booked", "Completed", "Confirmation rate", "Cancel rate",
    "No-show rate", "Reschedule rate", "UTM conversions", "Awaiting",
  ],
  reminders: ["Reminders sent", "Email opens", "Confirmation rate", "Booked"],
  automations: ["Reminders sent", "Reschedule requests", "No-shows", "UTM conversions"],
  reports: [],
};

function RangeToggle({
  range,
  onChange,
}: {
  range: 7 | 30;
  onChange: (r: 7 | 30) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="inline-flex items-center rounded-lg border border-border bg-card p-0.5"
    >
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={range === option.value}
          className={cn(
            "h-7 rounded-md px-3 text-xs font-semibold transition-colors",
            range === option.value
              ? "bg-primary text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsClient({ section }: { section: AnalyticsSection }) {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [exporting, setExporting] = useState(false);

  // Preserve wiring: fetch(`/api/appointments/analytics?range=${range}`)
  useEffect(() => {
    setState("loading");
    const t = setTimeout(() => {
      const d = getAnalytics(range);
      setData(d);
      setState(d.booked === 0 ? "empty" : "ready");
    }, 450);
    return () => clearTimeout(t);
  }, [range]);

  // Preserve handler: export via /api/appointments/analytics/export
  async function handleExport() {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 800));
    setExporting(false);
  }

  const metrics = useMemo(() => {
    if (!data) return [];
    const all = buildMetrics(data);
    const wanted = SECTION_METRICS[section];
    if (wanted.length === 0) return all;
    return wanted
      .map((label) => all.find((m) => m.label === label))
      .filter((m): m is MetricDef => Boolean(m));
  }, [data, section]);

  const meta = sectionMeta[section];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {meta.title}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {meta.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangeToggle range={range} onChange={setRange} />
          <Button
            variant="secondary"
            size="md"
            onClick={handleExport}
            disabled={exporting || state !== "ready"}
          >
            <Download size={15} />
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>

      {/* States */}
      {state === "loading" ? (
        <>
          <MetricSkeletonGrid count={section === "reports" ? 4 : 8} />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="p-5">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="mt-5 h-44 animate-pulse rounded-lg bg-muted" />
              </Card>
            </div>
            <Card className="p-5">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-5 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : state === "error" ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1">
              <CardTitle>Analytics couldn't be loaded</CardTitle>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Something went wrong while loading appointment metrics for the
                last {range} days. Your data is unaffected.
              </p>
              <div className="mt-3">
                <Button size="sm" onClick={() => setRange(range)}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : state === "empty" || !data ? (
        <EmptyState
          icon={<BarChart3 size={20} />}
          title="No appointment data yet"
          description="Analytics appear here once appointments are booked, confirmed, and completed in this workspace."
          actionLabel="Create appointment"
          onAction={() => {}}
        />
      ) : (
        <div className="fade-up space-y-5">
          {/* Metric grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>

          {section === "reports" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ScheduleReportCard />
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
                    <FileBarChart2 size={18} />
                  </div>
                  <div>
                    <CardTitle>Export data</CardTitle>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Download a CSV of appointment, reminder, and conversion
                      metrics for the selected range.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    <Download size={14} />
                    {exporting ? "Exporting…" : `Export ${range}-day CSV`}
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <>
              {/* Chart + side panels */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <BookingsChart series={data.series} rangeDays={range} />
                </div>
                <PopularTypes types={data.popularTypes ?? []} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <PopularTimes times={data.popularTimes ?? []} />
                </div>

                {section === "reminders" ? (
                  <Card className="p-5">
                    <CardTitle>Delivery health</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Reminder delivery in this range
                    </p>
                    <dl className="mt-4 space-y-3">
                      {[
                        { label: "Sent", value: formatNumber(data.remindersSent), icon: Bell, tone: "text-primary" },
                        { label: "Failed", value: formatNumber(data.remindersFailed), icon: AlertTriangle, tone: data.remindersFailed > 0 ? "text-rose-600" : "text-muted-foreground" },
                        { label: "Email clicks", value: formatNumber(data.emailClicks), icon: MousePointerClick, tone: "text-sky-600" },
                        { label: "SMS responses", value: formatNumber(data.smsResponses), icon: Reply, tone: "text-emerald-600" },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <row.icon size={15} className={row.tone} />
                            {row.label}
                          </dt>
                          <dd className="text-[13px] font-semibold tabular-nums text-foreground">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {data.remindersFailed > 0 ? (
                      <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-800">
                        {data.remindersFailed} reminders failed to send. Review
                        the affected appointments in Messages.
                      </div>
                    ) : null}
                  </Card>
                ) : section === "automations" ? (
                  <Card className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                        <Workflow size={18} />
                      </div>
                      <div>
                        <CardTitle>Workflow impact</CardTitle>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Automated follow-ups recovered{" "}
                          <span className="font-semibold text-foreground">
                            {formatNumber(Math.round(data.noShow * 0.5))}
                          </span>{" "}
                          no-shows and processed{" "}
                          <span className="font-semibold text-foreground">
                            {formatNumber(data.rescheduleRequested)}
                          </span>{" "}
                          reschedule requests in this range.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {[
                        { label: "Confirmation rate", value: data.confirmationRate, tone: "bg-emerald-500" },
                        { label: "Conversion rate", value: data.conversionRate, tone: "bg-primary" },
                        { label: "Reschedule rate", value: data.rescheduleRate, tone: "bg-violet-500" },
                      ].map((r) => (
                        <div key={r.label}>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-medium text-muted-foreground">{r.label}</span>
                            <span className="text-xs font-semibold tabular-nums text-foreground">{r.value}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", r.tone)} style={{ width: `${Math.min(100, r.value)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : (
                  <ScheduleReportCard />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
