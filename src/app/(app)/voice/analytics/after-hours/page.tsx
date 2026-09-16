"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Summary = {
  aiHandledCalls?: number;
  resolutionRate?: number | null;
  frictionCounts?: Record<string, number>;
  recoverySmsSent?: number;
  callbacksOverdue?: number;
};

export default function AfterHoursAnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/voice-v2/analytics/after-hours");
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Failed to load analytics");
      return;
    }
    setSummary(json.summary || null);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">After-hours analytics</h1>
          <p className="text-sm text-muted-foreground">
            Resolution, friction, recovery, and callback outcomes from voice call quality records.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard label="Calls (range)" value={String(summary.aiHandledCalls ?? 0)} />
          <MetricCard
            label="Resolution rate"
            value={
              summary.resolutionRate == null
                ? "—"
                : `${Math.round((summary.resolutionRate || 0) * 100)}%`
            }
          />
          <MetricCard label="Recovery texts" value={String(summary.recoverySmsSent ?? 0)} />
          <MetricCard label="Overdue callbacks" value={String(summary.callbacksOverdue ?? 0)} />
        </div>
      ) : null}

      {summary?.frictionCounts ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Friction signals</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {Object.entries(summary.frictionCounts).map(([type, count]) => (
              <li key={type} className="flex justify-between gap-4">
                <span>{type.replace(/_/g, " ")}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <Link href="/voice/operations" className="text-primary underline">
          Mobile operations
        </Link>{" "}
        for tonight&apos;s on-call and temporary closure overrides.
      </p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
