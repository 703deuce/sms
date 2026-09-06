"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarCheck2,
  CheckCircle2,
  Download,
  MessageSquareReply,
  RefreshCcw,
  Send,
  UserX,
  Zap,
} from "lucide-react";
import {
  formatNumber,
  formatSeriesDate,
  mockAnalytics,
  RANGE_OPTIONS,
  type AnalyticsData,
} from "../mock-data";
import { cn } from "./AnalyticsShell";
import { Card, MetricCard } from "./MetricCard";
import { EmptyState, ErrorState, MetricSkeleton, TableSkeleton } from "./States";
import { WorkflowPerformanceTable } from "./WorkflowPerformanceTable";
import { ScheduleReportCard } from "./ScheduleReportCard";

const CHART_HEIGHT = 148;

function DeliveryChart({ data }: { data: AnalyticsData }) {
  const max = useMemo(
    () => Math.max(...data.series.map((d) => d.sent), 1),
    [data],
  );
  const totalFailed = data.series.reduce((a, d) => a + d.failed, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
            Automation message delivery
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Workflow and reminder steps sent per day · {totalFailed} failed in range
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> Delivered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "#f43f5e" }} /> Failed
          </span>
        </div>
      </div>
      <div
        className="mt-5 flex items-end gap-1.5"
        style={{ height: CHART_HEIGHT }}
        role="img"
        aria-label={`Automation delivery chart for the last ${data.rangeDays} days. ${data.stepsDelivered} delivered, ${data.stepsFailed} failed.`}
      >
        {data.series.map((d) => {
          const deliveredPx = Math.max(Math.round((d.delivered / max) * (CHART_HEIGHT - 18)), 3);
          const failedPx = d.failed > 0 ? Math.max(Math.round((d.failed / max) * (CHART_HEIGHT - 18)), 3) : 0;
          return (
            <div
              key={d.date}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <div
                className="flex w-full flex-col items-stretch justify-end"
                style={{ gap: 1 }}
                title={`${formatSeriesDate(d.date)} — ${d.delivered} delivered, ${d.failed} failed`}
              >
                {failedPx > 0 ? (
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{ height: failedPx, background: "#f43f5e" }}
                  />
                ) : null}
                <div
                  className={cn(
                    "w-full bg-primary/85 transition-colors group-hover:bg-primary",
                    failedPx > 0 ? "rounded-b-[3px]" : "rounded-[3px]",
                  )}
                  style={{ height: deliveredPx }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] text-muted-foreground",
                  data.rangeDays === 30 && "hidden",
                )}
              >
                {formatSeriesDate(d.date)}
              </span>
            </div>
          );
        })}
      </div>
      {data.rangeDays === 30 ? (
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatSeriesDate(data.series[0].date)}</span>
          <span>{formatSeriesDate(data.series[data.series.length - 1].date)}</span>
        </div>
      ) : null}
    </Card>
  );
}

export function AnalyticsAutomations() {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  // Preserves existing fetch contract: GET /api/appointments/analytics?range=N
  useEffect(() => {
    setLoading(true);
    setError(false);
    const t = setTimeout(() => {
      setData(mockAnalytics[range]);
      // Simulated partial/degraded signal: workflow executions lag behind on 30d
      setDegraded(range === 30);
      setLoading(false);
    }, 650);
    return () => clearTimeout(t);
  }, [range]);

  const cards = data
    ? [
        { label: "Active workflows", value: formatNumber(data.activeWorkflows), icon: Zap, tone: "bg-primary/10 text-primary", hint: `${formatNumber(data.workflowExecutions)} executions` },
        { label: "Steps sent", value: formatNumber(data.stepsSent), icon: Send, tone: "bg-primary/10 text-primary", hint: `${data.stepsFailed} failed` },
        { label: "Delivery rate", value: `${data.deliveryRate.toFixed(1)}%`, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", hint: `${formatNumber(data.stepsDelivered)} delivered` },
        { label: "Reminders sent", value: formatNumber(data.remindersSent), icon: Bell, tone: "bg-primary/10 text-primary", hint: `${data.remindersFailed} failed` },
        { label: "Confirmations", value: formatNumber(data.confirmationsReceived), icon: CalendarCheck2, tone: "bg-emerald-50 text-emerald-600", hint: `${data.confirmationRate.toFixed(1)}% confirmation rate` },
        { label: "Replies handled", value: formatNumber(data.workflows.reduce((a, w) => a + w.replies, 0)), icon: MessageSquareReply, tone: "bg-sky-50 text-sky-600", hint: "Across all workflows" },
        { label: "Reschedules handled", value: formatNumber(data.rescheduleHandled), icon: RefreshCcw, tone: "bg-violet-50 text-violet-600", hint: "Follow-up automation" },
        { label: "No-show recoveries", value: formatNumber(data.noShowRecovery), icon: UserX, tone: "bg-orange-50 text-orange-600", hint: "Rebooked after no-show" },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Section header + range control */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
            Automations
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Workflow execution, reminder delivery, and automated customer response metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-border bg-card p-0.5"
            role="group"
            aria-label="Date range"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                aria-pressed={range === option.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  range === option.value
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={{ border: "none", cursor: "pointer" }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              // Preserves existing export handler: GET /api/appointments/analytics/export
              setExporting(true);
              setExported(false);
              await new Promise((r) => setTimeout(r, 800));
              setExporting(false);
              setExported(true);
            }}
            disabled={exporting || loading || !!error}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            style={{ cursor: "pointer" }}
          >
            <Download size={13} />
            {exporting ? "Exporting…" : exported ? "Downloaded" : "Export"}
          </button>
        </div>
      </div>

      {degraded && !loading && !error ? (
        <div
          className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px]"
          style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}
          role="status"
        >
          <Bell size={15} className="mt-0.5 shrink-0" />
          <span>
            Workflow execution counts for the 30-day range are still aggregating. Delivery and
            reply metrics are current; execution totals may be slightly understated.
          </span>
        </div>
      ) : null}

      {error ? (
        <ErrorState onRetry={() => setRange((r) => r)} />
      ) : loading ? (
        <>
          <MetricSkeleton />
          <TableSkeleton />
        </>
      ) : !data || data.stepsSent === 0 ? (
        <EmptyState
          title="No automation activity yet"
          description={`No workflow steps or reminders were sent in the last ${range} days. Activate a workflow to start automating appointment reminders and follow-ups.`}
          actionLabel="Go to Workflows"
          actionHref="/appointments/workflows"
          icon={<Zap size={20} />}
        />
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <MetricCard
                key={c.label}
                label={c.label}
                value={c.value}
                icon={c.icon}
                tone={c.tone}
                hint={c.hint}
              />
            ))}
          </div>

          {/* Delivery chart */}
          <DeliveryChart data={data} />

          {/* Workflow performance table */}
          <WorkflowPerformanceTable workflows={data.workflows} />

          {/* Schedule email report */}
          <ScheduleReportCard />
        </>
      )}
    </div>
  );
}
