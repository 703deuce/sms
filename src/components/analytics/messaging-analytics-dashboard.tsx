"use client";

import { MetricCard, SectionHeader } from "@/components/ui/metric";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { MessagingAnalyticsPayload } from "@/lib/analytics/messaging-analytics";
import { BarChart3, Download, Inbox, Link2, Send, UserMinus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const RANGE_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function deltaPct(current: number, previous: number | undefined): string | null {
  if (previous == null || previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function MiniBarChart({
  series,
  keys,
  colors,
}: {
  series: Array<Record<string, number | string>>;
  keys: string[];
  colors: string[];
}) {
  const max = Math.max(
    1,
    ...series.flatMap((row) => keys.map((k) => Number(row[k] || 0))),
  );

  return (
    <div className="flex h-40 items-end gap-1">
      {series.map((row) => (
        <div key={String(row.date)} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-32 w-full items-end justify-center gap-0.5">
            {keys.map((key, i) => {
              const val = Number(row[key] || 0);
              const h = Math.max(4, (val / max) * 100);
              return (
                <div
                  key={key}
                  className="w-2 rounded-t-sm"
                  style={{ height: `${h}%`, backgroundColor: colors[i] }}
                  title={`${key}: ${val}`}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {String(row.date).slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MessagingAnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [compare, setCompare] = useState(false);
  const [data, setData] = useState<MessagingAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (compare) params.set("compare", "1");
      const res = await fetch(`/api/analytics/messaging?${params}`);
      const json = await res.json();
      setData(json.data || null);
    } finally {
      setLoading(false);
    }
  }, [days, compare]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = data?.kpis;
  const compareKpis = data?.compareKpis;

  const timeSeries = useMemo(() => {
    if (!data?.timeSeries?.length) {
      return [{ date: new Date().toISOString().slice(0, 10), sent: 0, delivered: 0, failed: 0 }];
    }
    return data.timeSeries.slice(-14);
  }, [data]);

  if (loading && !data) {
    return <p className="text-[13px] text-muted-foreground">Loading analytics…</p>;
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={BarChart3}
        iconTone="bg-indigo-50 text-indigo-600"
        title="Analytics"
        description="Track delivery, engagement, replies, clicks, and opt-outs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-[10px] border border-border bg-background px-3 text-[13px]"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              variant={compare ? "primary" : "outline"}
              className="h-9 rounded-[10px] text-[13px]"
              onClick={() => setCompare((v) => !v)}
            >
              Compare previous period
            </Button>
            <Button variant="outline" className="h-9 rounded-[10px] text-[13px]" disabled>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Messages sent"
          value={formatNumber(kpis?.messagesSent || 0)}
          hint={deltaPct(kpis?.messagesSent || 0, compareKpis?.messagesSent) || "Selected period"}
          icon={Send}
          tone="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="Delivery rate"
          value={formatPercent(kpis?.deliveryRate || 0)}
          hint={deltaPct(kpis?.deliveryRate || 0, compareKpis?.deliveryRate) || "Carrier receipts"}
          icon={Send}
          tone="bg-emerald-50 text-emerald-600"
          className="ring-1 ring-emerald-100"
        />
        <MetricCard
          label="Reply rate"
          value={formatPercent(kpis?.replyRate || 0)}
          hint={deltaPct(kpis?.replyRate || 0, compareKpis?.replyRate) || undefined}
          icon={Inbox}
          tone="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="Click rate"
          value={formatPercent(kpis?.clickRate || 0)}
          hint={deltaPct(kpis?.clickRate || 0, compareKpis?.clickRate) || undefined}
          icon={Link2}
          tone="bg-orange-50 text-orange-600"
        />
        <MetricCard
          label="Opt-out rate"
          value={formatPercent(kpis?.optOutRate || 0)}
          hint={deltaPct(kpis?.optOutRate || 0, compareKpis?.optOutRate) || undefined}
          icon={UserMinus}
          tone="bg-slate-100 text-slate-600"
        />
      </div>

      <Card className="rounded-[12px] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-bold text-foreground">Messaging performance</h2>
          <div className="flex gap-3 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> Sent
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400" /> Failed
            </span>
          </div>
        </div>
        <div className="mt-4">
          <MiniBarChart
            series={timeSeries}
            keys={["sent", "delivered", "failed"]}
            colors={["#6366f1", "#10b981", "#f87171"]}
          />
        </div>
        <div className="mt-3 flex gap-6 text-[13px] text-muted-foreground">
          <span>Sent {formatNumber(kpis?.messagesSent || 0)}</span>
          <span>Delivered {formatNumber(kpis?.delivered || 0)}</span>
          <span>Failed {formatNumber(kpis?.failed || 0)}</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-[12px] p-5">
          <h2 className="text-[14px] font-bold text-foreground">Delivery health</h2>
          <ul className="mt-4 space-y-3 text-[13px]">
            <HealthRow
              label="Delivered"
              count={kpis?.delivered || 0}
              pct={kpis?.deliveryRate || 0}
              tone="text-emerald-600"
            />
            <HealthRow
              label="Pending"
              count={kpis?.pending || 0}
              pct={kpis?.messagesSent ? ((kpis.pending / kpis.messagesSent) * 100) : 0}
              tone="text-amber-600"
            />
            <HealthRow
              label="Failed"
              count={kpis?.failed || 0}
              pct={kpis?.messagesSent ? ((kpis.failed / kpis.messagesSent) * 100) : 0}
              tone="text-red-600"
            />
          </ul>
        </Card>

        <Card className="rounded-[12px] p-5">
          <h2 className="text-[14px] font-bold text-foreground">Failure reasons</h2>
          {data?.failureReasons?.length ? (
            <ul className="mt-4 space-y-2">
              {data.failureReasons.map((row) => (
                <li
                  key={row.category}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="text-foreground">{row.label}</span>
                  <span className="font-semibold tabular-nums text-muted-foreground">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">No delivery failures in this period.</p>
          )}
        </Card>
      </div>

      <Card className="rounded-[12px] p-5">
        <h2 className="text-[14px] font-bold text-foreground">Engagement</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <EngagementStat label="Replies" value={formatNumber(kpis?.replies || 0)} sub={formatPercent(kpis?.replyRate || 0)} />
          <EngagementStat
            label="Unique clicks"
            value={formatNumber(kpis?.uniqueClicks || 0)}
            sub={formatPercent(kpis?.clickRate || 0)}
          />
          <EngagementStat
            label="Opt-outs"
            value={formatNumber(kpis?.optOuts || 0)}
            sub={formatPercent(kpis?.optOutRate || 0)}
          />
        </div>
        <div className="mt-6">
          <MiniBarChart
            series={timeSeries}
            keys={["uniqueClicks", "optOuts"]}
            colors={["#f97316", "#94a3b8"]}
          />
        </div>
      </Card>

      <Card className="rounded-[12px] p-5">
        <h2 className="text-[14px] font-bold text-foreground">Campaign performance</h2>
        {data?.campaigns?.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium">Sent</th>
                  <th className="pb-2 font-medium">Delivery</th>
                  <th className="pb-2 font-medium">Replies</th>
                  <th className="pb-2 font-medium">Clicks</th>
                  <th className="pb-2 font-medium">Opt-outs</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2.5">
                      <Link href={`/campaigns/${row.id}`} className="font-medium text-primary hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2.5 tabular-nums">{formatNumber(row.sent)}</td>
                    <td className="py-2.5 tabular-nums">{formatPercent(row.deliveryRate)}</td>
                    <td className="py-2.5 tabular-nums">{formatPercent(row.replyRate)}</td>
                    <td className="py-2.5 tabular-nums">{formatPercent(row.clickRate)}</td>
                    <td className="py-2.5 tabular-nums">
                      <span className={cn(row.optOutRate > 2 ? "text-amber-600 font-semibold" : "")}>
                        {formatPercent(row.optOutRate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-muted-foreground">No campaigns in this period.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-[12px] p-5">
          <h2 className="text-[14px] font-bold text-foreground">Top links</h2>
          {data?.topLinks?.length ? (
            <ul className="mt-4 space-y-3 text-[13px]">
              {data.topLinks.map((link) => (
                <li key={`${link.destinationUrl}-${link.campaignId}`} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-foreground">{link.destinationUrl}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatNumber(link.uniqueClicks)} unique · {formatPercent(link.ctr)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">No tracked link clicks yet.</p>
          )}
        </Card>

        <Card className="rounded-[12px] p-5">
          <h2 className="text-[14px] font-bold text-foreground">Reply performance</h2>
          <ul className="mt-4 space-y-3 text-[13px]">
            <li className="flex justify-between">
              <span>Replies</span>
              <span className="font-semibold tabular-nums">{formatNumber(data?.replyPerformance.replies || 0)}</span>
            </li>
            <li className="flex justify-between">
              <span>Unique people replying</span>
              <span className="font-semibold tabular-nums">
                {formatNumber(data?.replyPerformance.uniqueRepliers || 0)}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Conversations started</span>
              <span className="font-semibold tabular-nums">
                {formatNumber(data?.replyPerformance.conversationsStarted || 0)}
              </span>
            </li>
          </ul>
          {data?.optOutHealth.highestCampaign ? (
            <p className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              Highest opt-out: {data.optOutHealth.highestCampaign.name} (
              {formatPercent(data.optOutHealth.highestCampaign.rate)})
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function HealthRow({
  label,
  count,
  pct,
  tone,
}: {
  label: string;
  count: number;
  pct: number;
  tone: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className={cn("font-medium", tone)}>{label}</span>
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(count)} · {formatPercent(pct)}
      </span>
    </li>
  );
}

function EngagementStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[10px] border border-border p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[20px] font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}
