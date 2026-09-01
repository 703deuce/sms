"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { SmsDashboardActivityPoint, SmsDashboardMetrics } from "@/lib/sms/dashboard-metrics";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Megaphone,
  MessageSquare,
  Send,
  Upload,
} from "lucide-react";

type Props = {
  metrics: SmsDashboardMetrics;
};

type ActivityMetric = "sent" | "delivered" | "replies";

const RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function ActivityChart({
  series,
  metric,
}: {
  series: SmsDashboardActivityPoint[];
  metric: ActivityMetric;
}) {
  const hasActivity = series.some((p) => p[metric] > 0);

  if (!series.length || !hasActivity) {
    return (
      <div className="flex h-36 flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
        <Send className="h-7 w-7 text-muted-foreground/50" />
        <p className="mt-3 text-[14px] font-medium text-foreground">No messages sent yet</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
          Send your first campaign to see delivery trends here.
        </p>
        <Link href="/campaigns/new/promotional" className="mt-4">
          <Button size="sm">Create campaign</Button>
        </Link>
      </div>
    );
  }

  const max = Math.max(1, ...series.map((p) => p[metric]));

  const color =
    metric === "sent" ? "#6366f1" : metric === "delivered" ? "#10b981" : "#8b5cf6";
  const width = Math.max(series.length * 12, 120);

  const points = series
    .map((p, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * (width - 8) + 4;
      const y = 150 - (p[metric] / max) * 130;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-48">
      <svg viewBox={`0 0 ${width} 160`} className="h-full w-full" preserveAspectRatio="none">
        <polyline
          fill={`${color}18`}
          stroke="none"
          points={`4,150 ${points} ${width - 4},150`}
        />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{series[0]?.date.slice(5)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function KpiStat({
  label,
  value,
  hint,
  href,
  hero,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  hero?: boolean;
  muted?: boolean;
}) {
  const body = (
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-tight tabular-nums",
          hero ? "text-[32px] text-foreground" : "text-[24px]",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );

  const cardClass = cn(
    "rounded-[14px] border border-border bg-card p-5",
    hero && "border-primary/20 bg-primary/[0.03] sm:col-span-2 xl:col-span-1",
  );

  if (href) {
    return (
      <Link href={href} className={cn("block transition hover:border-primary/30", cardClass)}>
        {body}
      </Link>
    );
  }

  return <div className={cardClass}>{body}</div>;
}

export function SmsDashboardView({ metrics }: Props) {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<ActivityMetric>("sent");
  const [activity, setActivity] = useState(metrics.messagingActivity);
  const [activityLoading, setActivityLoading] = useState(false);

  const loadActivity = useCallback(async (d: number) => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/sms/dashboard/activity?days=${d}`);
      const json = await res.json();
      setActivity(json.data?.series || []);
    } catch {
      setActivity(metrics.messagingActivity);
    } finally {
      setActivityLoading(false);
    }
  }, [metrics.messagingActivity]);

  useEffect(() => {
    void loadActivity(days);
  }, [days, loadActivity]);

  const attentionItems = useMemo(() => {
    const items: Array<{ label: string; href?: string; tone?: "warn" | "ok" }> = [];

    if (metrics.attention.unreadConversations > 0) {
      items.push({
        label: `${formatNumber(metrics.attention.unreadConversations)} unread conversation${metrics.attention.unreadConversations === 1 ? "" : "s"}`,
        href: "/inbox",
        tone: "warn",
      });
    }
    if (metrics.attention.failedMessages30d > 0) {
      items.push({
        label: `${formatNumber(metrics.attention.failedMessages30d)} failed message${metrics.attention.failedMessages30d === 1 ? "" : "s"}`,
        href: "/sms/analytics?tab=messaging",
        tone: "warn",
      });
    }
    if (metrics.attention.contactsNeedingAttention > 0) {
      items.push({
        label: `${formatNumber(metrics.attention.contactsNeedingAttention)} contact${metrics.attention.contactsNeedingAttention === 1 ? "" : "s"} need attention`,
        href: "/contacts",
        tone: "warn",
      });
    }
    if (!metrics.complianceHealthy) {
      items.push({
        label: `Compliance: ${metrics.a2pStatus}`,
        href: "/compliance",
        tone: "warn",
      });
    }
    if (items.length === 0) {
      items.push({
        label: "Compliance healthy",
        href: "/compliance",
        tone: "ok",
      });
    }

    return items;
  }, [metrics]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const campaignsWithActivity = useMemo(
    () => metrics.recentCampaigns.filter((c) => c.sent > 0),
    [metrics.recentCampaigns],
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{greeting}</h1>
          <p className="mt-1 max-w-xl text-[14px] text-muted-foreground">
            Account health at a glance — messaging, delivery, and what needs your attention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/campaigns/new/promotional">
            <Button className="h-9 rounded-[10px] px-4">
              <Megaphone className="h-4 w-4" />
              Send Campaign
            </Button>
          </Link>
          <Link href="/contacts">
            <Button variant="outline" className="h-9 rounded-[10px] px-3">
              <Upload className="h-4 w-4" />
              Add Contacts
            </Button>
          </Link>
          <Link href="/inbox">
            <Button variant="outline" className="h-9 rounded-[10px] px-3">
              <Inbox className="h-4 w-4" />
              View Inbox
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStat
          label="Active Contacts"
          value={formatNumber(metrics.activeContacts)}
          hint={
            metrics.contactsAddedThisMonth > 0
              ? `+${formatNumber(metrics.contactsAddedThisMonth)} this month`
              : "Subscribed contacts"
          }
          href="/contacts"
          hero
        />
        <KpiStat
          label="Messages Sent"
          value={formatNumber(metrics.messagesSent30Days)}
          hint="Last 30 days"
          muted={metrics.messagesSent30Days === 0}
        />
        <KpiStat
          label="Delivery Rate"
          value={formatPercent(metrics.deliveryRate)}
          hint={`${formatNumber(metrics.deliveredCount)} delivered`}
          muted={metrics.messagesSent30Days === 0}
        />
        <KpiStat
          label="Replies"
          value={formatNumber(metrics.replies)}
          hint={`${formatPercent(metrics.replyRate)} response rate`}
          href="/inbox"
          muted={metrics.replies === 0}
        />
      </div>

      <section className="rounded-[14px] border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Messaging Activity</h2>
            <p className="text-[12px] text-muted-foreground">Volume over the selected period</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-[10px] border border-border bg-muted/40 p-0.5">
              <span className="sr-only">Metric</span>
              {(["sent", "delivered", "replies"] as ActivityMetric[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  className={cn(
                    "rounded-[8px] px-3 py-1.5 text-[12px] font-medium capitalize transition",
                    metric === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <span className="hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
              Range
            </span>
            <div className="inline-flex rounded-[10px] border border-border bg-muted/40 p-0.5">
              {RANGE_OPTIONS.map((o) => (
                <button
                  key={o.days}
                  type="button"
                  onClick={() => setDays(o.days)}
                  className={cn(
                    "rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition",
                    days === o.days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={cn("mt-4", activityLoading && "opacity-60")}>
          <ActivityChart series={activity} metric={metric} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-[14px] border border-border bg-card p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-foreground">Recent Campaigns</h2>
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              View all campaigns
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {campaignsWithActivity.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
              <Send className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-[14px] font-medium text-foreground">No sent campaigns yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {metrics.recentCampaigns.length > 0
                  ? "You have drafts ready — send one to see performance here."
                  : "Create a campaign to start reaching your audience."}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Link href="/campaigns/new/promotional">
                  <Button size="sm">Send your first campaign</Button>
                </Link>
                {metrics.recentCampaigns.length > 0 ? (
                  <Link href="/campaigns/drafts">
                    <Button size="sm" variant="outline">
                      View drafts
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-3 text-left font-medium">Campaign</th>
                    <th className="pb-2 pr-3 text-right font-medium">Sent</th>
                    <th className="pb-2 pr-3 text-right font-medium">Delivered</th>
                    <th className="pb-2 pr-3 text-right font-medium">Clicks</th>
                    <th className="pb-2 pr-3 text-right font-medium">Replies</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignsWithActivity.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-foreground hover:text-primary">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatNumber(c.sent)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatPercent(c.deliveryRate)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatNumber(c.clicks)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatNumber(c.replies)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[14px] border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold text-foreground">Needs Attention</h2>
          <ul className="mt-4 space-y-2.5">
            {attentionItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href || "#"}
                  className={cn(
                    "flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13px] transition hover:bg-muted/50",
                    item.tone === "warn" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.tone === "warn" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {metrics.recentReplies.length > 0 ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Latest replies</p>
              <ul className="mt-3 space-y-3">
                {metrics.recentReplies.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/inbox?conversation=${r.conversationId}`}
                      className="block rounded-[10px] p-2 transition hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[13px] font-medium text-foreground">{r.contactName}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {new Date(r.at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 pl-5 text-[12px] text-muted-foreground">{r.preview}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
