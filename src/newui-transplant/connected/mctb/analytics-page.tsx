"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Page, PageHeader, Panel, Stat, TextLink } from "@/newui-transplant/components/app/kit";
import { TrendArea } from "@/newui-transplant/components/app/charts";
import { td, th } from "@/newui-transplant/components/app/opus-tables";
import { OPUS_CARD, OPUS_TABLE_HEAD } from "@/newui-transplant/components/app/opus-surfaces";
import { Segmented } from "@/newui-transplant/components/app/segmented-nav";
import { mergeDailyTrends } from "@/lib/newui-transplant/adapters/chart-series";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { missedCallsDateFromAnalyticsRange } from "@/lib/newui-transplant/missed-calls-query";
import { cn } from "@/lib/utils";

type AnalyticsPayload = Awaited<ReturnType<typeof import("@/lib/mctb/analytics").loadMctbAnalytics>>;

function pct(a: number, b: number) {
  if (b <= 0) return "0%";
  return `${Math.round((a / b) * 100)}%`;
}

export function NewUiMctbAnalyticsPage({ initialData, initialRange }: { initialData: AnalyticsPayload; initialRange: MctbAnalyticsRange }) {
  const [range, setRange] = useState<MctbAnalyticsRange>(initialRange);
  const [data, setData] = useState(initialData);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const refresh = async (next: MctbAnalyticsRange) => {
    const prevRange = range;
    setRange(next);
    setRangeError(null);
    const res = await fetch(`/api/mctb/analytics?range=${next}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.data) {
      setRange(prevRange);
      setRangeError(typeof j.error === "string" ? j.error : "Could not load analytics for that range.");
      return;
    }
    setData(j.data as AnalyticsPayload);
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

  const funnel = useMemo(
    () => [
      { label: "Missed calls", value: data.totalMissed, note: "100%" },
      { label: "Eligible", value: data.eligible, note: pct(data.eligible, data.totalMissed) },
      { label: "Recovery texts sent", value: data.textsSent, note: `${pct(data.textsSent, data.eligible)} of eligible` },
      { label: "Customer replies", value: data.replies, note: `${pct(data.replies, data.textsSent)} of sent` },
    ],
    [data],
  );

  const suppressionRows = Object.entries(data.suppressionByReason);
  const suppressedTotal = suppressionRows.reduce((s, [, n]) => s + n, 0) || 1;
  const missedCallsDateParam = missedCallsDateFromAnalyticsRange(range);

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description="How missed-call recovery turns lost calls into conversations."
        actions={
          <Segmented
            label="Date range"
            options={["7d", "30d", "90d"]}
            value={range}
            onChange={(r) => refresh(r as MctbAnalyticsRange)}
            formatLabel={(r) => (r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days")}
          />
        }
      />

      {rangeError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">{rangeError}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Missed calls"
          value={String(data.totalMissed)}
          href={`/mctb/missed-calls?date=${missedCallsDateParam}`}
        />
        <Stat
          label="Recovery texts sent"
          value={String(data.textsSent)}
          href={`/mctb/missed-calls?date=${missedCallsDateParam}`}
        />
        <Stat
          label="Customers replied"
          value={String(data.replies)}
          href={`/mctb/missed-calls?status=replied&date=${missedCallsDateParam}`}
        />
        <Stat label="Reply rate" value={pct(data.replies, data.textsSent)} />
      </div>

      <Panel className="mt-4" title="Recovery funnel">
        <ol className="grid gap-3 sm:grid-cols-4">
          {funnel.map((f, i) => (
            <li key={f.label} className="flex flex-col gap-2">
              <div className="h-24 overflow-hidden rounded-lg bg-muted">
                <div
                  className="h-full rounded-lg bg-gradient-to-t from-primary to-[oklch(0.66_0.2_285)]"
                  style={{
                    opacity: 1 - i * 0.15,
                    width: data.totalMissed > 0 ? `${(f.value / data.totalMissed) * 100}%` : "0%",
                  }}
                />
              </div>
              <span className="text-xl font-semibold tabular-nums">{f.value}</span>
              <span className="text-sm">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.note}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="mt-4" title="Recovery over time">
        <TrendArea
          data={chartRows}
          series={[
            { key: "missed", label: "Missed", color: "var(--chart-4)" },
            { key: "texts", label: "Texts", color: "var(--chart-1)" },
            { key: "replies", label: "Replies", color: "var(--chart-2)" },
          ]}
          height={240}
        />
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Outcomes & delivery" bodyClassName="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            ["Delivery failures", String(data.deliveryFailures)],
            ["Booking links sent", String(data.bookingLinksSent)],
            ["Callback requests", String(data.callbackRequested)],
            ["AI-assisted", String(data.aiAssistedConversations)],
            ["Link clicks", String(data.linkClicks)],
            ["Opt-outs", String(data.optOuts)],
          ].map(([label, value]) => (
            <div key={label} className={`flex flex-col gap-1 p-3 ${OPUS_CARD}`}>
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-lg font-semibold tabular-nums">{value}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Why some callers were not texted" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={th}>Reason</th>
                  <th scope="col" className={cn(th, "text-right")}>Count</th>
                  <th scope="col" className={cn(th, "text-right")}>%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suppressionRows.map(([reason, count]) => (
                  <tr key={reason}>
                    <td className={td}>{reason}</td>
                    <td className={cn(td, "text-right tabular-nums")}>
                      <Link
                        href={`/mctb/missed-calls?status=suppressed&date=${missedCallsDateParam}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {count}
                      </Link>
                    </td>
                    <td className={cn(td, "text-right text-muted-foreground tabular-nums")}>
                      {Math.round((count / suppressedTotal) * 100)}%
                    </td>
                  </tr>
                ))}
                {suppressionRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={cn(td, "text-muted-foreground")}>No suppressions in this period.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Definitions" className="lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Eligible", "Missed calls from textable numbers that are not excluded or in cooldown."],
              ["Recovery texts sent", "Eligible calls that received a text back from your business line."],
              ["Customer replies", "Conversations where the customer sent at least one reply."],
              ["Reply rate", "Customer replies divided by recovery texts sent."],
            ].map(([t, d]) => (
              <div key={t} className="flex flex-col gap-1">
                <dt className="text-sm font-medium">{t}</dt>
                <dd className="text-pretty text-sm text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Voicemail">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{data.voicemailCount}</p>
              <p className="text-sm text-muted-foreground">voicemails left in this period</p>
            </div>
            <TextLink href="/mctb/voicemail">Open voicemail</TextLink>
          </div>
        </Panel>
      </div>
    </Page>
  );
}
