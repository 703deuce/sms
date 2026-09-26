"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Page, PageHeader, Panel, Stat, TextLink } from "@/newui-transplant/components/app/kit";
import { TrendArea } from "@/newui-transplant/components/app/charts";
import { mergeDailyTrends } from "@/lib/newui-transplant/adapters/chart-series";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { cn } from "@/lib/utils";

type AnalyticsPayload = Awaited<ReturnType<typeof import("@/lib/mctb/analytics").loadMctbAnalytics>>;

export function NewUiMctbAnalyticsPage({ initialData, initialRange }: { initialData: AnalyticsPayload; initialRange: MctbAnalyticsRange }) {
  const [range, setRange] = useState<MctbAnalyticsRange>(initialRange);
  const [data, setData] = useState(initialData);

  const refresh = async (next: MctbAnalyticsRange) => {
    setRange(next);
    const res = await fetch(`/api/mctb/analytics?range=${next}`, { cache: "no-store" });
    const j = await res.json();
    if (j.data) setData(j.data as AnalyticsPayload);
  };

  const chartRows = useMemo(() => {
    const days = data.trends.missedCalls.map((p) => p.date);
    return mergeDailyTrends({
      days,
      missed: data.trends.missedCalls,
      texts: data.trends.recoveryTexts,
      replies: data.trends.replies,
    });
  }, [data]);

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description="Recovery performance for missed calls."
        actions={
          <div role="group" aria-label="Date range" className="inline-flex rounded-lg border bg-card p-0.5">
            {(["7d", "30d", "90d"] as MctbAnalyticsRange[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => refresh(r)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missed calls" value={String(data.totalMissed)} href={`/mctb/missed-calls?range=${range}`} />
        <Stat label="Recovery texts" value={String(data.textsSent)} href="/mctb/missed-calls" />
        <Stat label="Replies" value={String(data.replies)} href="/mctb/conversations" />
        <Stat label="Reply rate" value={`${Math.round(data.replyRate * 100)}%`} />
      </div>

      <Panel className="mt-4" title="Recovery over time">
        <TrendArea
          data={chartRows}
          series={[
            { key: "missed", label: "Missed", color: "var(--chart-2)" },
            { key: "texts", label: "Texts", color: "var(--chart-1)" },
            { key: "replies", label: "Replies", color: "var(--chart-3)" },
          ]}
          height={240}
        />
      </Panel>

      <Panel className="mt-4" title="Why some callers were not texted">
        <ul className="divide-y text-sm">
          {Object.entries(data.suppressionByReason).map(([reason, count]) => (
            <li key={reason} className="flex items-center justify-between py-2">
              <span>{reason}</span>
              <Link href={`/mctb/missed-calls?recovery=suppressed`} className="font-medium text-primary">
                {count}
              </Link>
            </li>
          ))}
          {Object.keys(data.suppressionByReason).length === 0 ? (
            <li className="py-2 text-muted-foreground">No suppressions in this period.</li>
          ) : null}
        </ul>
        <TextLink href="/mctb/missed-calls?recovery=suppressed" className="mt-3 inline-block">
          View suppressed missed calls
        </TextLink>
      </Panel>
    </Page>
  );
}
