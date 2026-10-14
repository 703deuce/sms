"use client";

import { Button } from "@/newui-transplant/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard, SectionHeader } from "@/components/ui/metric";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { SmsAnalyticsPayload } from "@/lib/sms/analytics";
import {
  ArrowRight,
  BarChart3,
  Check,
  Download,
  Inbox,
  Link2,
  MousePointerClick,
  Send,
  TriangleAlert,
  UserMinus,
  UserPlus,
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
  height = 160,
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
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center"
        style={{ minHeight: Math.min(height, 140) }}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">No data for this period</p>
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          Analytics will appear after you send campaigns.
        </p>
      </div>
    );
  }

  const max = Math.max(1, ...series.flatMap((row) => keys.map((k) => Number(row[k] || 0))));

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {series.map((row) => (
        <div key={String(row.date)} className="group flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end justify-center gap-0.5">
            {keys.map((key, i) => {
              const val = Number(row[key] || 0);
              const h = Math.max(3, (val / max) * 100);
              return (
                <div
                  key={key}
                  className="w-2 rounded-t-[3px] transition-opacity duration-150 group-hover:opacity-80"
                  style={{ height: `${h}%`, backgroundColor: colors[i] }}
                  title={`${key}: ${val}`}
                />
              );
            })}
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {String(row.date).slice(5)}
          </span>
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
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-display text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
        {formatNumber(value)}
      </p>
      {label !== "Sent" ? (
        <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">{rateLabel}</p>
      ) : null}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted/60", className)} />;
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
        <div key={m.label} className="surface rounded-xl bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {m.label}
          </p>
          <p className="mt-1.5 font-display text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
            {m.value}
          </p>
          {m.hint ? (
            <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">{m.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RatePill({ value, tone }: { value: number; tone: "good" | "warn" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums",
        tone === "good" && "bg-emerald-50 text-emerald-700",
        tone === "warn" && "bg-amber-50 text-amber-700",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {formatPercent(value)}
    </span>
  );
}

function rateTone(value: number, goodAt: number): "good" | "warn" | "neutral" {
  if (value <= 0) return "neutral";
  return value >= goodAt ? "good" : "warn";
}

function TableShell({
  head,
  children,
  emptyTitle,
  emptyDescription,
  isEmpty,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Inbox className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-border bg-muted/40">{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

const thClass =
  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
const tdClass = "px-4 py-3 text-[13px] text-foreground";
const tdNumClass = cn(tdClass, "text-right tabular-nums");

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
    return [...data.campaigns]
      .filter((c) => c.sent > 0)
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 5);
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
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
          <TriangleAlert className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">Could not load analytics</p>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{error}</p>
        <Button size="sm" className="mt-5" onClick={() => void load()}>
          Try again
        </Button>
      </Card>
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
              className="h-9 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
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
              variant={compare ? "secondary" : "ghost"}
              size="default"
              className={cn("text-[13px]", compare && "font-semibold")}
              onClick={() => setCompare((v) => !v)}
            >
              {compare ? <Check className="h-4 w-4" /> : null}
              Compare previous period
            </Button>
            <Button variant="outline" size="default" className="text-[13px]" disabled>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3.5 pb-2.5 pt-1 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[12px] font-medium text-muted-foreground">Updating…</p>
      ) : null}

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

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
                Performance trend
              </h2>
            </div>
            <div className="mt-5">
              <TrendChart
                series={timeSeries}
                keys={["sent", "delivered", "uniqueClicks", "replies"]}
                colors={["#6366f1", "#10b981", "#f97316", "#8b5cf6"]}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3.5 text-[12px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" /> Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Clicks
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-500" /> Replies
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
              Engagement funnel
            </h2>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:gap-4">
              <FunnelStep label="Sent" value={kpis?.messagesSent || 0} sentTotal={kpis?.messagesSent || 0} />
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

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
                Top campaigns
              </h2>
              <Link
                href="/sms/analytics?tab=campaigns"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <TableShell
              isEmpty={topCampaigns.length === 0}
              emptyTitle="No sent campaigns in this period"
              emptyDescription="Send a campaign to start seeing performance data here."
              head={
                <>
                  <th className={thClass}>Campaign</th>
                  <th className={cn(thClass, "text-right")}>Sent</th>
                  <th className={cn(thClass, "text-right")}>Delivered</th>
                  <th className={cn(thClass, "text-right")}>Clicks</th>
                  <th className={cn(thClass, "text-right")}>Replies</th>
                </>
              }
            >
              {topCampaigns.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/40">
                  <td className={cn(tdClass, "font-medium")}>{c.name}</td>
                  <td className={tdNumClass}>{formatNumber(c.sent)}</td>
                  <td className={tdNumClass}>
                    <RatePill value={c.deliveryRate} tone={rateTone(c.deliveryRate, 90)} />
                  </td>
                  <td className={tdNumClass}>{formatNumber(c.clicks)}</td>
                  <td className={tdNumClass}>{formatNumber(c.replies)}</td>
                </tr>
              ))}
            </TableShell>
          </Card>
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
              Campaign performance
            </h2>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {data?.campaigns?.length || 0} campaigns
            </span>
          </div>
          <TableShell
            isEmpty={!data?.campaigns?.length}
            emptyTitle="No campaigns in this period"
            emptyDescription="Campaigns sent during the selected range will show up here."
            head={
              <>
                <th className={thClass}>Campaign</th>
                <th className={cn(thClass, "text-right")}>Sent</th>
                <th className={cn(thClass, "text-right")}>Delivered</th>
                <th className={cn(thClass, "text-right")}>Failed</th>
                <th className={cn(thClass, "text-right")}>Delivery rate</th>
                <th className={cn(thClass, "text-right")}>Click rate</th>
                <th className={cn(thClass, "text-right")}>Reply rate</th>
                <th className={cn(thClass, "text-right")}>Opt-out rate</th>
              </>
            }
          >
            {(data?.campaigns || []).map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-muted/40">
                <td className={cn(tdClass, "max-w-[240px]")}>
                  <p className="truncate font-medium">{c.name}</p>
                  {c.sentAt ? (
                    <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                      {new Date(c.sentAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  ) : null}
                </td>
                <td className={tdNumClass}>{formatNumber(c.sent)}</td>
                <td className={tdNumClass}>{formatNumber(c.delivered)}</td>
                <td className={cn(tdNumClass, c.failed > 0 && "text-danger")}>
                  {formatNumber(c.failed)}
                </td>
                <td className={tdNumClass}>
                  <RatePill value={c.deliveryRate} tone={rateTone(c.deliveryRate, 90)} />
                </td>
                <td className={tdNumClass}>
                  <RatePill value={c.clickRate} tone={rateTone(c.clickRate, 2)} />
                </td>
                <td className={tdNumClass}>
                  <RatePill value={c.replyRate} tone={rateTone(c.replyRate, 5)} />
                </td>
                <td className={tdNumClass}>
                  <RatePill
                    value={c.optOutRate}
                    tone={c.optOutRate > 1 ? "warn" : "neutral"}
                  />
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      ) : null}

      {tab === "audience" ? (
        <div className="space-y-5">
          <MetricStrip
            columns={4}
            items={[
              {
                label: "Active contacts",
                value: formatNumber(audience?.activeContacts || 0),
              },
              {
                label: "New opt-ins",
                value: formatNumber(audience?.newOptIns || 0),
              },
              {
                label: "Unsubscribes",
                value: formatNumber(audience?.unsubscribes || 0),
              },
              {
                label: "Net growth",
                value: `${(audience?.netGrowth || 0) >= 0 ? "+" : ""}${formatNumber(audience?.netGrowth || 0)}`,
              },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
                  Audience growth
                </h2>
              </div>
              <div className="mt-5">
                <TrendChart
                  series={audience?.growthSeries || []}
                  keys={["optIns", "unsubscribes"]}
                  colors={["#10b981", "#f43f5e"]}
                  height={140}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3.5 text-[12px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Opt-ins
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Unsubscribes
                </span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
                  Subscriber sources
                </h2>
              </div>
              {!audience?.sources?.length ? (
                <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">No sources yet</p>
                  <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                    Opt-in sources will appear as contacts subscribe.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3.5">
                  {audience.sources.map((s) => (
                    <div key={s.source}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-foreground">{s.source}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatNumber(s.count)} · {formatPercent(s.share)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.max(2, s.share)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="px-5 pt-4 pb-3">
              <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
                Top lists
              </h2>
            </div>
            <TableShell
              isEmpty={!audience?.topLists?.length}
              emptyTitle="No lists yet"
              emptyDescription="Create a list to organize your audience."
              head={
                <>
                  <th className={thClass}>List</th>
                  <th className={cn(thClass, "text-right")}>Contacts</th>
                </>
              }
            >
              {(audience?.topLists || []).map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/40">
                  <td className={cn(tdClass, "font-medium")}>{l.name}</td>
                  <td className={tdNumClass}>{formatNumber(l.contacts)}</td>
                </tr>
              ))}
            </TableShell>
          </Card>
        </div>
      ) : null}

      {tab === "messaging" ? (
        <div className="space-y-5">
          <MetricStrip
            columns={4}
            items={[
              { label: "Delivered", value: formatNumber(kpis?.delivered || 0) },
              {
                label: "Failed",
                value: formatNumber(kpis?.failed || 0),
                hint: (kpis?.failed || 0) > 0 ? "Review failure reasons below" : null,
              },
              { label: "Pending", value: formatNumber(kpis?.pending || 0) },
              { label: "Opt-outs", value: formatNumber(kpis?.optOuts || 0) },
            ]}
          />

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
                Failure reasons
              </h2>
            </div>
            {!data?.failureReasons?.length ? (
              <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">No failures</p>
                <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                  No failed messages in this period. Great deliverability.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3.5">
                {(() => {
                  const total = data.failureReasons.reduce((s, r) => s + r.count, 0) || 1;
                  return data.failureReasons.map((r) => {
                    const share = (r.count / total) * 100;
                    return (
                      <div key={r.category}>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-medium text-foreground">{r.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatNumber(r.count)} · {formatPercent(share)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-danger transition-all duration-300"
                            style={{ width: `${Math.max(2, share)}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
                Delivery & engagement trend
              </h2>
            </div>
            <div className="mt-5">
              <TrendChart
                series={timeSeries}
                keys={["delivered", "failed", "optOuts"]}
                colors={["#10b981", "#f43f5e", "#f97316"]}
                height={140}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3.5 text-[12px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Failed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Opt-outs
              </span>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
