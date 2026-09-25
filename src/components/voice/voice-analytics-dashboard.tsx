"use client";

import "@/components/mctb/analytics/mctb-analytics.css";
import { MctbAnalyticsChart } from "@/components/mctb/analytics/mctb-analytics-chart";
import { Card, StatCard } from "@/components/ui/card";
import { TransovoProductPage } from "@/components/transovo/product-page";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { ANALYTICS_OUTCOME_DISPLAY_ORDER } from "@/lib/voice/analytics/voice-analytics-aggregate";
import type { VoiceAnalyticsReceptionist } from "@/lib/voice/analytics";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsPayload = {
  receptionist: VoiceAnalyticsReceptionist;
};

const DAY_OPTIONS: Array<{ days: number; label: string; range: MctbAnalyticsRange }> = [
  { days: 7, label: "7 days", range: "7d" },
  { days: 30, label: "30 days", range: "30d" },
  { days: 90, label: "90 days", range: "90d" },
];

function parseDays(raw: string | null): number {
  const n = Number(raw || "30");
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatLatencySeconds(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function KpiSkeleton() {
  return (
    <div className="transovo-kpi-strip--inline transovo-kpi-strip" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="transovo-kpi-inline-item">
          <div className="transovo-kpi-skeleton-value" />
          <p className="transovo-kpi-inline-label">Loading</p>
        </div>
      ))}
    </div>
  );
}

export function VoiceAnalyticsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = useMemo(() => parseDays(searchParams.get("days")), [searchParams]);

  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const setDays = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("days", String(next));
      router.push(`/voice/analytics?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/voice/analytics?days=${days}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.data?.receptionist) setError(j.error || "Failed to load analytics");
        else setData(j.data);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [days]);

  const r = data?.receptionist;
  const chartRange = DAY_OPTIONS.find((o) => o.days === days)?.range ?? "30d";

  const outcomeRows = useMemo(() => {
    if (!r) return [];
    const rows = ANALYTICS_OUTCOME_DISPLAY_ORDER
      .map((label) => ({
        label,
        count: r.materialOutcomes[label] ?? 0,
      }))
      .filter((row) => row.count > 0);
    if (r.transfersAnswered > 0) {
      rows.unshift({ label: "Transfers answered", count: r.transfersAnswered });
    }
    return rows.sort((a, b) => b.count - a.count);
  }, [r]);

  const sentimentTotal = r
    ? r.sentimentCounts.positive +
      r.sentimentCounts.neutral +
      r.sentimentCounts.negative +
      r.sentimentCounts.unknown
    : 0;
  const showSentiment = sentimentTotal >= 10;

  const callsDateRange = days === 7 ? "7d" : "30d";

  return (
    <TransovoProductPage>
      <VoiceSubNav />
      <PageHeader
        title="Analytics"
        description="Understand call volume, outcomes, and receptionist performance."
        className="!mb-0"
        actions={
          <div
            className="inline-flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Date range"
          >
            {DAY_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                aria-pressed={days === opt.days}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  days === opt.days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setDays(days)}>
            Retry
          </button>
        </Card>
      ) : loading && !r ? (
        <>
          <KpiSkeleton />
          <div className="mt-8 h-[240px] animate-pulse rounded-xl bg-muted/40" />
        </>
      ) : !r ? null : r.totalCalls === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No calls in this period.</p>
          <p className="mt-2">
            Try another date range or make sure your receptionist is live.
          </p>
        </Card>
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
            aria-label="Key metrics"
          >
            <StatCard
              label="Calls"
              value={formatNumber(r.totalCalls ?? 0)}
              hint="Non-test inbound calls"
              href={`/voice/calls?dateRange=${callsDateRange}`}
            />
            <StatCard
              label="Appointments booked"
              value={formatNumber(r.appointmentsBooked)}
              href="/voice/calls?filter=booked"
            />
            <StatCard
              label="Transfers answered"
              value={formatNumber(r.transfersAnswered)}
              href="/voice/calls?filter=transferred"
            />
            <StatCard
              label="Callbacks requested"
              value={formatNumber(r.callbacksRequested)}
              href="/voice/calls?filter=messages"
            />
            <StatCard
              label="Avg. duration"
              value={formatDuration(r.avgDurationSeconds)}
            />
            <StatCard
              label="Voicemail"
              value={formatNumber(r.voicemailCount)}
              hint={`${Math.round(r.voicemailRate * 100)}% of inbound`}
            />
          </div>

          {r.openKnowledgeGaps > 0 ? (
            <Card className="mt-4 p-4 text-sm">
              <Link
                href="/voice/knowledge#knowledge-gaps"
                className="font-medium text-primary underline"
              >
                {r.openKnowledgeGaps} unanswered question
                {r.openKnowledgeGaps === 1 ? "" : "s"} need review
              </Link>
              <span className="text-muted-foreground"> — Review in Business Knowledge.</span>
            </Card>
          ) : null}

          <section className="mt-8" aria-labelledby="voice-analytics-volume-heading">
            <MctbAnalyticsChart
              title="Call volume over time"
              total={r.totalCalls}
              series={r.dailyCallVolume}
              range={chartRange}
              metricName="calls"
              emptyMessage="No calls in this period."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Daily buckets use your business timezone ({r.timezone}).
            </p>
            <table className="sr-only">
              <caption>Daily call volume</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Calls</th>
                </tr>
              </thead>
              <tbody>
                {r.dailyCallVolume.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-8" aria-labelledby="voice-analytics-outcomes-heading">
            <h2
              id="voice-analytics-outcomes-heading"
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Call outcomes
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              A call can count toward more than one outcome. Percentages are not shown because
              outcomes are not mutually exclusive.
            </p>
            <Card className="divide-y divide-border p-0">
              {outcomeRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <span>{row.label}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(row.count)}</span>
                </div>
              ))}
            </Card>
          </section>

          <section className="mt-8" aria-labelledby="voice-analytics-performance-heading">
            <h2
              id="voice-analytics-performance-heading"
              className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Receptionist performance
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Median response time
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold">
                  {formatLatencySeconds(r.responseLatency.medianResponseLatencyMs)}
                </p>
                {r.responseLatency.responseLatencySampleSize > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Based on {formatNumber(r.responseLatency.responseLatencySampleSize)} measured
                    responses. Caller end-of-speech to first agent audio.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Not enough data in this period.</p>
                )}
              </Card>
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Transfers failed
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold">
                  {formatNumber(r.transfersFailed)}
                </p>
                <Link
                  href="/voice/calls?attention=open"
                  className="mt-1 inline-block text-xs text-primary underline"
                >
                  View needs attention
                </Link>
              </Card>
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Voicemail (inbound)
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold">
                  {formatNumber(r.voicemailCount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Math.round(r.voicemailRate * 100)}% of inbound calls in period
                </p>
              </Card>
            </div>
          </section>

          {showSentiment ? (
            <section className="mt-8" aria-labelledby="voice-analytics-sentiment-heading">
              <h2
                id="voice-analytics-sentiment-heading"
                className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Caller sentiment
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Based on {formatNumber(sentimentTotal)} analyzed calls. Not a measure of customer
                satisfaction.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Positive" value={formatNumber(r.sentimentCounts.positive)} />
                <StatCard label="Neutral" value={formatNumber(r.sentimentCounts.neutral)} />
                <StatCard label="Negative" value={formatNumber(r.sentimentCounts.negative)} />
                <StatCard label="Unknown" value={formatNumber(r.sentimentCounts.unknown)} />
              </div>
            </section>
          ) : null}

          <section className="mt-8" aria-labelledby="voice-analytics-usage-heading">
            <h2
              id="voice-analytics-usage-heading"
              className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Usage
            </h2>
            <Card className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-6">
                <span>
                  <span className="text-muted-foreground">AI minutes:</span>{" "}
                  <span className="font-semibold">{formatNumber(r.usage.aiMinutes)}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Phone minutes:</span>{" "}
                  <span className="font-semibold">{formatNumber(r.usage.telephonyMinutes)}</span>
                </span>
              </div>
              <Link href="/voice/billing" className="font-medium text-primary underline">
                View usage & billing →
              </Link>
            </Card>
          </section>

          <section className="mt-8">
            <button
              type="button"
              className="text-sm font-medium text-primary underline"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? "Hide advanced" : "Show advanced"}
            </button>
            {advancedOpen ? (
              <Card className="mt-3 p-4 text-sm text-muted-foreground">
                {r.responseLatency.p95ResponseLatencyMs != null ? (
                  <p>
                    Response latency p95:{" "}
                    {formatLatencySeconds(r.responseLatency.p95ResponseLatencyMs)}
                  </p>
                ) : (
                  <p>Response latency p95: not available for this period.</p>
                )}
              </Card>
            ) : null}
          </section>
        </>
      )}
    </TransovoProductPage>
  );
}
