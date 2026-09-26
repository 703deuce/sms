"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, Panel, Stat } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";
import { TrendArea } from "@/newui-transplant/components/app/charts";
import { mergeDailyTrends } from "@/lib/newui-transplant/adapters/chart-series";
import type { VoiceAnalyticsReceptionist } from "@/lib/voice/analytics";

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function NewUiVoiceAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<VoiceAnalyticsReceptionist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/voice/analytics?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData(j.data as VoiceAnalyticsReceptionist))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const chartRows = useMemo(() => {
    if (!data) return [];
    const dayKeys = data.dailyCallVolume.map((d) => d.date);
    return mergeDailyTrends({
      days: dayKeys,
      calls: data.dailyCallVolume,
    });
  }, [data]);

  const chartSeries = useMemo(
    () => [{ key: "calls" as const, label: "Calls", color: "var(--chart-1)" }],
    [],
  );

  const outcomes = data
    ? Object.entries(data.materialOutcomes).map(([label, value]) => ({ label, value }))
    : [];

  const sentiment = data
    ? [
        { label: "Positive", value: data.sentimentCounts.positive, className: "bg-success" },
        { label: "Neutral", value: data.sentimentCounts.neutral, className: "bg-chart-4" },
        { label: "Negative", value: data.sentimentCounts.negative, className: "bg-destructive" },
        { label: "Unknown", value: data.sentimentCounts.unknown, className: "bg-muted-foreground/30" },
      ]
    : [];

  const maxOutcome = Math.max(1, ...outcomes.map((o) => o.value));

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description="How your receptionist is performing."
        actions={
          <div role="group" aria-label="Date range" className="inline-flex rounded-lg border bg-card p-0.5">
            {[
              { label: "7 days", value: 7 },
              { label: "30 days", value: 30 },
              { label: "90 days", value: 90 },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={days === opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  days === opt.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Calls" value={loading ? "…" : String(data?.totalCalls ?? 0)} />
        <Stat label="Appointments booked" value={loading ? "…" : String(data?.appointmentsBooked ?? 0)} />
        <Stat label="Transfers answered" value={loading ? "…" : String(data?.transfersAnswered ?? 0)} />
        <Stat label="Callbacks requested" value={loading ? "…" : String(data?.callbacksRequested ?? 0)} />
        <Stat label="Avg. duration" value={loading ? "…" : fmtDuration(data?.avgDurationSeconds ?? 0)} />
        <Stat label="Voicemail" value={loading ? "…" : String(data?.voicemailCount ?? 0)} />
      </div>

      {(data?.openKnowledgeGaps ?? 0) > 0 ? (
        <Link
          href="/voice/knowledge"
          className="mt-4 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm transition hover:bg-warning/10"
        >
          <HelpCircle className="size-4 text-warning" aria-hidden="true" />
          <span className="flex-1">
            {data?.openKnowledgeGaps} open knowledge gap{data?.openKnowledgeGaps === 1 ? "" : "s"} may be affecting outcomes.
          </span>
          <span className="text-xs font-medium text-primary">Review</span>
        </Link>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Call volume over time" className="lg:col-span-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading chart…</p>
          ) : (
            <TrendArea data={chartRows} series={chartSeries} height={240} />
          )}
        </Panel>
        <Panel title="Outcomes">
          <ul className="flex flex-col gap-3">
            {outcomes.map((o) => (
              <li key={o.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{o.label}</span>
                  <span className="text-muted-foreground">{o.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(o.value / maxOutcome) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4" title="Caller sentiment">
        <div className="flex h-3 overflow-hidden rounded-full">
          {sentiment.map((s) => (
            <div
              key={s.label}
              className={s.className}
              style={{ width: `${((s.value / Math.max(1, data?.sentimentCounts.analyzedCalls ?? 1)) * 100).toFixed(1)}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {sentiment.map((s) => (
            <li key={s.label}>{s.label}: {s.value}</li>
          ))}
        </ul>
      </Panel>
    </Page>
  );
}
