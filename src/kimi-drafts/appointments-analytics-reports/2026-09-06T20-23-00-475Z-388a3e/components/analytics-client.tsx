"use client";

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
  FileBarChart2,
  FileText,
  Loader2,
  MailCheck,
  RefreshCcw,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AnalyticsData,
  AppointmentsAnalyticsSection,
  getAnalytics,
} from "../mock-data";

/* ---------- shared primitives ---------- */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatSeriesDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("surface rounded-xl bg-card p-5", className)}>
      {children}
    </div>
  );
}

function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      className={cn(
        "font-display text-sm font-semibold tracking-tight text-foreground",
        className
      )}
    >
      {children}
    </h3>
  );
}

function Button({
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-4 text-[13px]",
        variant === "primary" &&
          "bg-primary text-white hover:brightness-110",
        variant === "secondary" &&
          "surface bg-card text-foreground hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  icon,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  icon?: React.ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-sm font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actionLabel ? (
        <div className="mt-5">
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- range options ---------- */

const RANGE_OPTIONS: Array<{ value: 7 | 30; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

const FREQUENCY_OPTIONS: Array<{ value: "daily" | "weekly"; label: string; hint: string }> = [
  { value: "daily", label: "Daily", hint: "Sends every morning at 8:00 AM in your workspace timezone." },
  { value: "weekly", label: "Weekly", hint: "Sends every Monday at 8:00 AM in your workspace timezone." },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ---------- skeleton ---------- */

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

function PanelSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, j) => (
            <div
              key={j}
              className="h-3.5 w-full animate-pulse rounded bg-muted"
            />
          ))}
        </Card>
      ))}
    </div>
  );
}

/* ---------- main client ---------- */

export function AppointmentsAnalyticsClient({
  section = "reports",
}: {
  section?: AppointmentsAnalyticsSection;
}) {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"daily" | "weekly">("weekly");
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportedCsv, setExportedCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportedPdf, setExportedPdf] = useState(false);

  // Mirrors production fetch(`/api/appointments/analytics?range=${range}`)
  // In the sandbox this resolves from mock data with the same loading/error lifecycle.
  useEffect(() => {
    setLoading(true);
    setError(false);
    const t = setTimeout(() => {
      try {
        setData(getAnalytics(range));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [range]);

  const cards = data
    ? [
        { label: "Booked", value: formatNumber(data.booked), icon: CalendarPlus, tone: "bg-primary/10 text-primary" },
        { label: "Confirmed", value: formatNumber(data.confirmed), icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Awaiting", value: formatNumber(data.awaiting), icon: Clock3, tone: "bg-sky-50 text-sky-600" },
        { label: "Completed", value: formatNumber(data.completed ?? 0), icon: CalendarCheck2, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Canceled", value: formatNumber(data.canceled), icon: CalendarX2, tone: "bg-rose-50 text-rose-600" },
        { label: "No-shows", value: formatNumber(data.noShow), icon: CalendarClock, tone: "bg-orange-50 text-orange-600" },
        { label: "Reschedule requests", value: formatNumber(data.rescheduleRequested), icon: RefreshCcw, tone: "bg-violet-50 text-violet-600" },
        { label: "Reminders sent", value: formatNumber(data.remindersSent), icon: Bell, tone: "bg-primary/10 text-primary" },
        { label: "Confirmation rate", value: `${data.confirmationRate}%`, icon: CalendarCheck2, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Cancel rate", value: `${data.cancellationRate ?? 0}%`, icon: CalendarX2, tone: "bg-rose-50 text-rose-600" },
        { label: "No-show rate", value: `${data.noShowRate ?? 0}%`, icon: CalendarClock, tone: "bg-orange-50 text-orange-600" },
        { label: "Reschedule rate", value: `${data.rescheduleRate ?? 0}%`, icon: RefreshCcw, tone: "bg-violet-50 text-violet-600" },
        { label: "Email opens", value: formatNumber(data.emailOpens ?? 0), icon: MailCheck, tone: "bg-sky-50 text-sky-600" },
        { label: "UTM conversions", value: formatNumber(data.utmConversions ?? 0), icon: BarChart3, tone: "bg-primary/10 text-primary" },
      ]
    : [];

  const maxSeries = useMemo(
    () => Math.max(1, ...(data?.series.map((s) => s.count) ?? [1])),
    [data]
  );
  const maxType = useMemo(
    () => Math.max(1, ...(data?.popularTypes?.map((t) => t.count) ?? [1])),
    [data]
  );
  const maxTime = useMemo(
    () => Math.max(1, ...(data?.popularTimes?.map((t) => t.count) ?? [1])),
    [data]
  );

  const isEmpty =
    data != null && data.booked === 0 && data.remindersSent === 0;

  // Production: GET /api/appointments/analytics/export?range=${range}&format=csv
  const handleExportCsv = async () => {
    setExportingCsv(true);
    await new Promise((r) => setTimeout(r, 900));
    setExportingCsv(false);
    setExportedCsv(true);
    setTimeout(() => setExportedCsv(false), 3000);
  };

  // Production: GET /api/appointments/analytics/export?range=${range}&format=pdf
  const handleExportPdf = async () => {
    setExportingPdf(true);
    await new Promise((r) => setTimeout(r, 1100));
    setExportingPdf(false);
    setExportedPdf(true);
    setTimeout(() => setExportedPdf(false), 3000);
  };

  const handleSchedule = async () => {
    if (!EMAIL_RE.test(scheduleEmail)) return;
    setScheduling(true);
    await new Promise((r) => setTimeout(r, 800));
    setScheduling(false);
    setScheduled(true);
  };

  const exportDisabled = loading || error || isEmpty;
  const frequencyHint =
    FREQUENCY_OPTIONS.find((f) => f.value === scheduleFrequency)?.hint ?? "";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Full operational report across appointments, reminders, and
            conversions. Export or schedule delivery to your inbox.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Range selector */}
          <div
            role="group"
            aria-label="Date range"
            className="surface inline-flex rounded-lg bg-card p-0.5"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                aria-pressed={range === option.value}
                className={cn(
                  "h-8 rounded-md px-3 text-[12.5px] font-semibold transition-colors",
                  range === option.value
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={exportDisabled || exportingCsv}
          >
            {exportingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportedCsv ? "CSV downloaded" : exportingCsv ? "Preparing…" : "Export CSV"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportPdf}
            disabled={exportDisabled || exportingPdf}
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {exportedPdf ? "PDF downloaded" : exportingPdf ? "Generating…" : "Download PDF"}
          </Button>
        </div>
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-6">
          <MetricSkeleton />
          <PanelSkeleton />
        </div>
      ) : error ? (
        <Card>
          <div className="flex flex-col items-start gap-3 py-2">
            <div className="flex items-center gap-2.5">
              <div className="metric-icon bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[13.5px] font-semibold text-foreground">
                  Report data couldn’t be loaded
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Your filters and page context are unchanged. Try loading the
                  report again.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRange((r) => r)}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        </Card>
      ) : isEmpty ? (
        <EmptyState
          icon={<FileBarChart2 className="h-5 w-5" />}
          title="No report data yet"
          description="Reports populate once appointments are booked and reminders are sent. Create your first appointment to start seeing operational metrics here."
          actionLabel="Create appointment"
        />
      ) : data ? (
        <>
          {/* Degraded notice — partial data */}
          {data.remindersFailed > 0 ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[12.5px] leading-relaxed text-amber-800">
                <span className="font-semibold">
                  {data.remindersFailed} reminder
                  {data.remindersFailed === 1 ? "" : "s"} failed
                </span>{" "}
                in this period. Reminder delivery figures below may be
                incomplete. Review the Reminders tab for delivery details.
              </p>
            </div>
          ) : null}

          {/* Metric grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </p>
                    <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-foreground">
                      {c.value}
                    </p>
                  </div>
                  <div className={cn("metric-icon", c.tone)}>
                    <c.icon className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Bookings over time + popular booking types */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bookings over time</CardTitle>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Appointments booked per day · last {range} days
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  {formatNumber(data.booked)} total
                </span>
              </div>
              {data.series.length === 0 ? (
                <p className="mt-6 text-[12.5px] text-muted-foreground">
                  No bookings recorded in this range.
                </p>
              ) : (
                <div
                  className="mt-5 flex items-end gap-1.5"
                  role="img"
                  aria-label={`Bar chart of bookings per day, peaking at ${maxSeries} bookings`}
                >
                  {data.series.map((s) => (
                    <div
                      key={s.date}
                      className="group flex flex-1 flex-col items-center gap-1.5"
                    >
                      <span className="text-[10px] font-semibold text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        {s.count}
                      </span>
                      <div
                        className="chart-bar w-full"
                        style={{
                          height: `${Math.max(
                            6,
                            Math.round((s.count / maxSeries) * 96)
                          )}px`,
                        }}
                      />
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {formatSeriesDate(s.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardTitle>Popular booking types</CardTitle>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Most booked appointment types in this period
              </p>
              {!data.popularTypes || data.popularTypes.length === 0 ? (
                <p className="mt-6 text-[12.5px] text-muted-foreground">
                  No booking type data yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.popularTypes.map((t) => (
                    <li key={t.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[12.5px] font-medium text-foreground">
                          {t.name}
                        </span>
                        <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                          {formatNumber(t.count)}
                        </span>
                      </div>
                      <div className="bar-track h-1.5">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.round((t.count / maxType) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Popular times + engagement + schedule */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardTitle>Popular booking times</CardTitle>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Start hours customers choose most
              </p>
              {!data.popularTimes || data.popularTimes.length === 0 ? (
                <p className="mt-6 text-[12.5px] text-muted-foreground">
                  No time-of-day data yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {data.popularTimes.map((t) => {
                    const label = new Date(
                      2026, 0, 1, t.hour
                    ).toLocaleTimeString("en-US", {
                      hour: "numeric",
                    });
                    return (
                      <li key={t.hour} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
                          {label}
                        </span>
                        <div className="bar-track h-1.5 flex-1">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${Math.round(
                                (t.count / maxTime) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums text-foreground">
                          {t.count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>Message engagement</CardTitle>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Customer responses across channels
              </p>
              <dl className="mt-4 space-y-3">
                {[
                  { label: "Email opens", value: data.emailOpens ?? 0 },
                  { label: "Email clicks", value: data.emailClicks ?? 0 },
                  { label: "SMS responses", value: data.smsResponses ?? 0 },
                  { label: "UTM conversions", value: data.utmConversions ?? 0 },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between border-b border-border pb-2.5 last:border-0 last:pb-0"
                  >
                    <dt className="text-[12.5px] text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="text-[13px] font-semibold tabular-nums text-foreground">
                      {formatNumber(row.value)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <dt className="text-[12.5px] font-semibold text-foreground">
                    Conversion rate
                  </dt>
                  <dd className="text-[13px] font-bold tabular-nums text-primary">
                    {data.conversionRate ?? 0}%
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <CardTitle>Schedule this report</CardTitle>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Email a {range}-day summary to your team on a recurring
                schedule.
              </p>
              {scheduled ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-[12.5px] font-semibold text-emerald-800">
                        Report scheduled
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-700">
                        A {scheduleFrequency} {range}-day report will be sent to{" "}
                        <span className="font-semibold">{scheduleEmail}</span>.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduled(false)}
                  >
                    Edit schedule
                  </Button>
                </div>
              ) : (
                <form
                  className="mt-4 space-y-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSchedule();
                  }}
                >
                  <label
                    htmlFor="report-email"
                    className="block text-[12px] font-semibold text-foreground"
                  >
                    Delivery email
                  </label>
                  <input
                    id="report-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={scheduleEmail}
                    onChange={(e) => setScheduleEmail(e.target.value)}
                  />
                  <label
                    htmlFor="report-frequency"
                    className="block text-[12px] font-semibold text-foreground"
                  >
                    Frequency
                  </label>
                  <select
                    id="report-frequency"
                    value={scheduleFrequency}
                    onChange={(e) =>
                      setScheduleFrequency(e.target.value as "daily" | "weekly")
                    }
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={scheduling || !EMAIL_RE.test(scheduleEmail)}
                  >
                    {scheduling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {scheduling
                      ? "Scheduling…"
                      : `Schedule ${scheduleFrequency} report`}
                  </Button>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    {frequencyHint}
                  </p>
                </form>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
