"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard, SectionHeader } from "@/components/ui/metric";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { SmsAnalyticsPayload } from "@/lib/sms/analytics";
import {
  BarChart3,
  Download,
  Inbox,
  Link2,
  Send,
  UserMinus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const RANGE_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "audience", label: "Audience" },
  { id: "messaging", label: "Messaging" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function deltaPct(current: number, previous: number | undefined): string | null {
  if (previous == null || previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}% vs prior`;
}

function TrendChart({
  series,
  keys,
  colors,
  height = 140,
}: {
  series: Array<Record<string, number | string>>;
  keys: string[];
  colors: string[];
  height?: number;
}) {
  const hasData = series.some((row) => keys.some((k) => Number(row[k] || 0) > 0));

  if (!series.length || !hasData) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-muted/20 px-4 py-8 text-center"
        style={{ minHeight: Math.min(height, 120) }}
      >
        <p className="text-[14px] font-medium text-foreground">No data for this period</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Analytics will appear after you send campaigns.
        </p>
      </div>
    );
  }

  const max = Math.max(1, ...series.flatMap((row) => keys.map((k) => Number(row[k] || 0))));

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {series.map((row) => (
        <div key={String(row.date)} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end justify-center gap-0.5">
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
          <span className="text-[10px] text-muted-foreground">{String(row.date).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function FunnelStep({
  label,
  value,
  rate,
  sentTotal,
  isLast,
}: {
  label: string;
  value: number;
  rate?: number;
  sentTotal?: number;
  isLast?: boolean;
}) {
  const rateLabel =
    sentTotal === 0 || rate == null ? "—" : `${formatPercent(rate)} of sent`;

  return (
    <div className={cn("flex flex-1 flex-col", !isLast && "border-r border-border pr-4")}>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums text-foreground">{formatNumber(value)}</p>
      {label !== "Sent" ? (
        <p className="mt-0.5 text-[12px] text-muted-foreground">{rateLabel}</p>
      ) : null}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[12px] bg-muted/60", className)} />;
}

function MetricStrip({
  items,
  columns = 5,
}: {
  items: Array<{ label: string; value: string; hint?: string | null }>;
  columns?: 4 | 5;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        columns === 4 ? "xl:grid-cols-4" : "xl:grid-cols-5",
      )}
    >
      {items.map((m) => (
        <div key={m.label} className="rounded-[12px] border border-border bg-card p-4">
          <p className="text-[12px] text-muted-foreground">{m.label}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-foreground">{m.value}</p>
          {m.hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{m.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function SmsAnalyticsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId | null) || "overview";
  const [days, setDays] = useState(30);
  const [compare, setCompare] = useState(false);
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "overview",
  );
  const [data, setData] = useState<SmsAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (compare) params.set("compare", "1");
      const res = await fetch(`/api/sms/analytics?${params}`);
      if (!res.ok) throw new Error("Could not load analytics");
      const json = await res.json();
      setData(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [days, compare]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectTab = useCallback(
    (next: TabId) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/sms/analytics?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const raw = searchParams.get("tab") as TabId | null;
    if (raw && TABS.some((t) => t.id === raw) && raw !== tab) {
      setTab(raw);
    }
  }, [searchParams, tab]);

  const kpis = data?.kpis;
  const compareKpis = data?.compareKpis;
  const audience = data?.audience;

  const timeSeries = useMemo(() => {
    if (!data?.timeSeries?.length) return [];
    return data.timeSeries.slice(-Math.min(days, 30));
  }, [data, days]);

  const topCampaigns = useMemo(() => {
    if (!data?.campaigns?.length) return [];
    return [...data.campaigns].filter((c) => c.sent > 0).sort((a, b) => b.sent - a.sent).slice(0, 5);
  }, [data]);

  const tabMeta = TABS.find((t) => t.id === tab) ?? TABS[0];

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-8 text-center">
        <p className="text-[14px] font-medium text-foreground">Could not load analytics</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{error}</p>
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={BarChart3}
        iconTone="bg-indigo-50 text-indigo-600"
        title={tabMeta.label}
        description="Deep SMS performance — campaigns, audience, and deliverability."
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
              variant="ghost"
              className={cn(
                "h-9 rounded-[10px] text-[13px]",
                compare && "bg-muted text-foreground",
              )}
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

      <div className="flex flex-wrap gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold transition",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-[12px] text-muted-foreground">Updating…</p> : null}

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Messages sent"
              value={formatNumber(kpis?.messagesSent || 0)}
              hint={deltaPct(kpis?.messagesSent || 0, compareKpis?.messagesSent) || undefined}
              icon={Send}
              tone="bg-violet-50 text-violet-600"
            />
            <MetricCard
              label="Delivery rate"
              value={formatPercent(kpis?.deliveryRate || 0)}
              hint={deltaPct(kpis?.deliveryRate || 0, compareKpis?.deliveryRate) || undefined}
              icon={Send}
              tone="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              label="Click rate"
              value={formatPercent(kpis?.clickRate || 0)}
              hint={deltaPct(kpis?.clickRate || 0, compareKpis?.clickRate) || undefined}
              icon={Link2}
              tone="bg-orange-50 text-orange-600"
            />
            <MetricCard
              label="Reply rate"
              value={formatPercent(kpis?.replyRate || 0)}
              hint={deltaPct(kpis?.replyRate || 0, compareKpis?.replyRate) || undefined}
              icon={Inbox}
              tone="bg-violet-50 text-violet-600"
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
            <h2 className="text-[14px] font-semibold text-foreground">Performance trend</h2>
            <div className="mt-4">
              <TrendChart
                series={timeSeries}
                keys={["sent", "delivered", "uniqueClicks", "replies"]}
                colors={["#6366f1", "#10b981", "#f97316", "#8b5cf6"]}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Sent</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" /> Clicks</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" /> Replies</span>
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[14px] font-semibold text-foreground">Engagement funnel</h2>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <FunnelStep label="Sent" value={kpis?.messagesSent || 0} />
              <FunnelStep
                label="Delivered"
                value={kpis?.delivered || 0}
                rate={kpis?.deliveryRate}
                sentTotal={kpis?.messagesSent || 0}
              />
              <FunnelStep
                label="Clicked"
                value={kpis?.uniqueClicks || 0}
                rate={kpis?.clickRate}
                sentTotal={kpis?.messagesSent || 0}
              />
              <FunnelStep
                label="Replied"
                value={kpis?.replies || 0}
                rate={kpis?.replyRate}
                sentTotal={kpis?.messagesSent || 0}
                isLast
              />
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-foreground">Top campaigns</h2>
              <button type="button" onClick={() => selectTab("campaigns")} className="text-[13px] font-medium text-primary hover:underline">
                View all
              </button>
            </div>
            {topCampaigns.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 font-medium">Campaign</th>
                      <th className="pb-2 text-right font-medium">Sent</th>
                      <th className="pb-2 text-right font-medium">Delivery</th>
                      <th className="pb-2 text-right font-medium">CTR</th>
                      <th className="pb-2 text-right font-medium">Replies</th>
                      <th className="pb-2 text-right font-medium">Opt-outs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaigns.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5">
                          <Link href={`/campaigns/${row.id}`} className="font-medium text-foreground hover:text-primary">
                            {row.name}
                          </Link>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{formatNumber(row.sent)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(row.deliveryRate)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(row.clickRate)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(row.replyRate)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(row.optOutRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No sent campaigns in this period.</p>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <div className="space-y-5">
          <MetricStrip
            items={[
              { label: "Sent", value: formatNumber(kpis?.messagesSent || 0) },
              { label: "Delivered", value: formatNumber(kpis?.delivered || 0) },
              { label: "Clicks", value: formatNumber(kpis?.uniqueClicks || 0) },
              { label: "Replies", value: formatNumber(kpis?.replies || 0) },
              { label: "Opt-outs", value: formatNumber(kpis?.optOuts || 0) },
            ]}
          />

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[14px] font-semibold text-foreground">Campaign performance over time</h2>
            <div className="mt-4">
              <TrendChart series={timeSeries} keys={["sent", "delivered"]} colors={["#6366f1", "#10b981"]} />
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[14px] font-semibold text-foreground">Campaign performance</h2>
            {data?.campaigns?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 font-medium">Campaign</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 text-right font-medium">Recipients</th>
                      <th className="pb-2 text-right font-medium">Delivery</th>
                      <th className="pb-2 text-right font-medium">CTR</th>
                      <th className="pb-2 text-right font-medium">Replies</th>
                      <th className="pb-2 text-right font-medium">Opt-outs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5">
                          <Link href={`/campaigns/${row.id}`} className="font-medium text-foreground hover:text-primary">
                            {row.name}
                          </Link>
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {row.sentAt ? new Date(row.sentAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{formatNumber(row.sent)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(row.deliveryRate)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(row.clickRate)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(row.replyRate)}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          <span className={cn(row.optOutRate > 2 ? "font-semibold text-amber-600" : "")}>
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
        </div>
      ) : null}

      {tab === "audience" ? (
        <div className="space-y-5">
          <MetricStrip
            columns={4}
            items={[
              { label: "Active contacts", value: formatNumber(audience?.activeContacts || 0) },
              { label: "New opt-ins", value: formatNumber(audience?.newOptIns || 0) },
              { label: "Unsubscribes", value: formatNumber(audience?.unsubscribes || 0) },
              {
                label: "Net growth",
                value: formatNumber(audience?.netGrowth || 0),
                hint: (audience?.netGrowth || 0) >= 0 ? "Growing" : "Shrinking",
              },
            ]}
          />

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[14px] font-semibold text-foreground">Subscriber growth</h2>
            <div className="mt-4">
              <TrendChart
                series={audience?.growthSeries || []}
                keys={["optIns", "unsubscribes"]}
                colors={["#10b981", "#ef4444"]}
              />
            </div>
            <div className="mt-3 flex gap-4 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Opt-ins</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Unsubscribes</span>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[12px] p-5">
              <h2 className="text-[14px] font-semibold text-foreground">Where subscribers came from</h2>
              {audience?.sources?.length ? (
                <ul className="mt-4 space-y-2.5">
                  {audience.sources.map((s) => (
                    <li key={s.source} className="flex items-center justify-between gap-4 text-[13px]">
                      <span className="text-foreground">{s.source}</span>
                      <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                        <span className="text-foreground">{formatNumber(s.count)}</span>
                        <span className="mx-2 text-border">|</span>
                        {formatPercent(s.share)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[13px] text-muted-foreground">No opt-in source data for this period.</p>
              )}
            </Card>

            <Card className="rounded-[12px] p-5">
              <h2 className="text-[14px] font-semibold text-foreground">Top lists</h2>
              {audience?.topLists?.length ? (
                <ul className="mt-4 space-y-2.5">
                  {audience.topLists.map((l) => (
                    <li key={l.id} className="flex items-center justify-between text-[13px]">
                      <Link href="/contacts/lists" className="font-medium text-foreground hover:text-primary">
                        {l.name}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(l.contacts)} {l.contacts === 1 ? "contact" : "contacts"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[13px] text-muted-foreground">No lists yet.</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "messaging" ? (
        <div className="space-y-5">
          <MetricStrip
            columns={4}
            items={[
              { label: "Sent", value: formatNumber(kpis?.messagesSent || 0) },
              { label: "Delivered", value: formatNumber(kpis?.delivered || 0) },
              { label: "Failed", value: formatNumber(kpis?.failed || 0) },
              { label: "Delivery rate", value: formatPercent(kpis?.deliveryRate || 0) },
            ]}
          />

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[14px] font-semibold text-foreground">Delivery trend</h2>
            <div className="mt-4">
              <TrendChart series={timeSeries} keys={["delivered", "failed"]} colors={["#10b981", "#ef4444"]} />
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <h2 className="text-[14px] font-semibold text-foreground">Failure reasons</h2>
            {data?.failureReasons?.length ? (
              <ul className="mt-4 space-y-2.5">
                {data.failureReasons.map((row) => (
                  <li key={row.category} className="flex items-center justify-between text-[13px]">
                    <span className="text-foreground">{row.label}</span>
                    <span className="font-semibold tabular-nums text-muted-foreground">{formatNumber(row.count)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[13px] text-muted-foreground">No delivery failures in this period.</p>
            )}
            <p className="mt-4 text-[12px] text-muted-foreground">
              <Link href="/sms/analytics?tab=messaging" className="font-medium text-primary hover:underline">
                View message delivery log
              </Link>
            </p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
