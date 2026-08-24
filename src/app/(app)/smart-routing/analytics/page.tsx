"use client";

import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useState } from "react";

type AnalyticsData = {
  periodDays: number;
  callsRouted: number;
  answered: number;
  noAnswer: number;
  answerRate: number;
  outboundBusinessCallbacks: number;
  byFlow: Record<string, number>;
};

export default function SmartRoutingAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [flowNames, setFlowNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/smart-routing/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, string> = {};
        for (const f of j.data?.flows ?? []) {
          if (f.id && f.name) map[f.id] = f.name;
        }
        setFlowNames(map);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/smart-routing/analytics?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData(j.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const flowEntries = Object.entries(data?.byFlow || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Routing Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Call volume, answer rate, and flow performance for Smart Routing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="sr-days">
            Period
          </label>
          <select
            id="sr-days"
            className="h-9 rounded-lg border px-3 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <Link href="/smart-routing" className="text-sm font-medium text-primary hover:underline">
            Back to overview
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No analytics data yet.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Calls routed" value={data.callsRouted} />
            <MetricCard label="Answered" value={data.answered} />
            <MetricCard label="No answer" value={data.noAnswer} />
            <MetricCard label="Answer rate" value={`${data.answerRate}%`} />
          </div>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Outbound business callbacks</h2>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {data.outboundBusinessCallbacks}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Business-initiated return calls in the last {data.periodDays} days.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Volume by flow</h2>
            {flowEntries.length ? (
              <ul className="mt-3 space-y-2">
                {flowEntries.map(([flowId, count]) => (
                  <li
                    key={flowId}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={flowId === "unknown" ? "/smart-routing/flows" : `/smart-routing/${flowId}`}
                      className="text-primary hover:underline"
                    >
                      {flowId === "unknown"
                        ? "Unassigned flow"
                        : flowNames[flowId] || flowId}
                    </Link>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No routed calls in this period.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
