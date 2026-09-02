"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatNumber, formatPercent, formatPhone } from "@/lib/utils";
import type { SmsDashboardActivityPoint, SmsDashboardMetrics } from "@/lib/sms/dashboard-metrics";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
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

const METRIC_META: Record<ActivityMetric, { label: string; color: string }> = {
  sent: { label: "Sent", color: "#6366f1" },
  delivered: { label: "Delivered", color: "#10b981" },
  replies: { label: "Replies", color: "#8b5cf6" },
};

const EMPTY_ACTIVITY_COPY: Record<ActivityMetric, { title: string; body: string }> = {
  sent: {
    title: "No messages sent yet",
    body: "Send your first campaign to see delivery trends here.",
  },
  delivered: {
    title: "No deliveries yet",
    body: "Delivered volume will appear after your first campaign sends.",
  },
  replies: {
    title: "No replies yet",
    body: "When contacts respond, reply volume will show up on this chart.",
  },
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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
      <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Send className="h-4.5 w-4.5" />
        </div>
        <p className="mt-3 text-[13px] font-semibold text-foreground">{EMPTY_ACTIVITY_COPY[metric].title}</p>
        <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
          {EMPTY_ACTIVITY_COPY[metric].body}
        </p>
        <Link href="/campaigns/new/promotion" className="mt-4">
          <Button size="sm">Create campaign</Button>
        </Link>
      </div>
    );
  }

  const max = Math.max(1, ...series.map((p) => p[metric]));
  const { color } = METRIC_META[metric];
  const width = Math.max(series.length * 12, 120);

  const points = series
    .map((p, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * (width - 8) + 4;
      const y = 150 - (p[metric] / max) * 130;
      return `${x},${y}`;
    })
    .join(" ");

  const gridLines = [0.33, 0.66, 1].map((f) => 150 - f * 130);

  return (
    <div className="h-48">
      <svg viewBox={`0 0 ${width} 160`} className="h-full w-full" preserveAspectRatio="none">
        {gridLines.map((y) => (
          <line
            key={y}
            x1="4"
            x2={width - 4}
            y1={y}
            y2={y}
            stroke="currentColor"
            className="text-border/50"
            strokeWidth="1"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1="4"
          x2={width - 4}
          y1="150"
          y2="150"
          stroke="currentColor"
          className="text-border"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          fill={`${color}14`}
          stroke="none"
          points={`4,150 ${points} ${width - 4},150`}
        />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        {href ? (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 font-semibold tracking-tight tabular-nums",
          hero ? "text-[30px] leading-none" : "text-[24px] leading-none",
          muted ? "text-muted-foreground/70" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className={cn("mt-2 text-[12px]", muted ? "text-muted-foreground/60" : "text-muted-foreground")}>
          {hint}
        </p>
      ) : null}
    </div>
  );

  const cardClass = cn(
    "surface group h-full rounded-xl bg-card p-5",
    hero && "border-primary/25 bg-primary/[0.04] sm:col-span-2 xl:col-span-1",
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block transition-all duration-150 hover:border-primary/40 hover:shadow-md",
          cardClass,
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={cardClass}>{body}</div>;
}

function campaignStatusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  if (s === "sending" || s === "scheduled") return "bg-blue-50 text-blue-700 ring-blue-600/20";
  if (s === "failed" || s === "canceled") return "bg-rose-50 text-rose-700 ring-rose-600/20";
  if (s === "draft") return "bg-muted text-muted-foreground ring-border";
  return "bg-amber-50 text-amber-700 ring-amber-600/20";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        campaignStatusTone(status),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      if (!res.ok) throw new Error("activity fetch failed");
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
        href: "/conversations?filter=unread",
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
        href: "/contacts/validation",
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
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
            Account health at a glance — messaging, delivery, and what needs your attention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/campaigns/new/promotion">
            <Button>
              <Megaphone className="h-4 w-4" />
              Send Campaign
            </Button>
          </Link>
          <Link href="/contacts/imports">
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Import Contacts
            </Button>
          </Link>
          <Link href="/conversations">
            <Button variant="outline">
              <Inbox className="h-4 w-4" />
              View Inbox
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI row */}
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
          href="/sms/analytics"
          muted={metrics.messagesSent30Days === 0}
        />
        <KpiStat
          label="Delivery Rate"
          value={formatPercent(metrics.deliveryRate)}
          hint={`${formatNumber(metrics.deliveredCount)} delivered`}
          href="/sms/analytics?tab=messaging"
          muted={metrics.messagesSent30Days === 0}
        />
        <KpiStat
          label="Replies"
          value={formatNumber(metrics.replies)}
          hint={`${formatPercent(metrics.replyRate)} response rate`}
          href="/conversations"
          muted={metrics.replies === 0}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStat
          label="Credits remaining"
          value={formatNumber(metrics.creditsRemaining)}
          hint="SMS segments available"
          href="/settings/billing"
        />
        <KpiStat
          label="Sending number"
          value={metrics.sendingNumber ? formatPhone(metrics.sendingNumber) : "Not assigned"}
          hint={metrics.sendingNumber ? "10DLC sending line" : "Configure in Settings → Numbers"}
          href="/numbers"
          muted={!metrics.sendingNumber}
        />
        <KpiStat
          label="A2P registration"
          value={metrics.a2pStatus}
          hint={metrics.complianceHealthy ? "Ready to send" : "Complete compliance setup"}
          href="/compliance"
          muted={!metrics.complianceHealthy}
        />
        <KpiStat
          label="Scheduled campaigns"
          value={formatNumber(metrics.upcomingScheduled.length)}
          hint={
            metrics.upcomingScheduled.length > 0
              ? "Upcoming sends"
              : "No campaigns scheduled"
          }
          href="/campaigns/scheduled"
          muted={metrics.upcomingScheduled.length === 0}
        />
      </div>

      {/* Activity chart */}
      <section className="surface rounded-xl bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
              Messaging Activity
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Volume over the selected period
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedControl
              ariaLabel="Metric"
              value={metric}
              onChange={setMetric}
              options={(["sent", "delivered", "replies"] as ActivityMetric[]).map((m) => ({
                value: m,
                label: METRIC_META[m].label,
              }))}
            />
            <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 sm:inline">
              Range
            </span>
            <SegmentedControl
              ariaLabel="Date range"
              value={String(days)}
              onChange={(v) => setDays(Number(v))}
              options={RANGE_OPTIONS.map((o) => ({ value: String(o.days), label: o.label }))}
            />
          </div>
        </div>
        <div className={cn("mt-4 transition-opacity duration-200", activityLoading && "opacity-50")}>
          <ActivityChart series={activity} metric={metric} />
        </div>
      </section>

      {/* Bottom grid */}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="surface rounded-xl bg-card p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
                Recent Campaigns
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Performance of your latest sends
              </p>
            </div>
            <Link
              href="/campaigns"
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              View all campaigns
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {campaignsWithActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Send className="h-4.5 w-4.5" />
              </div>
              <p className="mt-3 text-[13px] font-semibold text-foreground">
                No sent campaigns yet
              </p>
              <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
                {metrics.recentCampaigns.length > 0
                  ? "You have drafts ready — send one to see performance here."
                  : "Create a campaign to start reaching your audience."}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Link href="/campaigns/new/promotion">
                  <Button size="sm">
                    {metrics.recentCampaigns.length > 0 ? "Send your first campaign" : "Create campaign"}
                  </Button>
                </Link>
                {metrics.recentCampaigns.length > 0 ? (
                  <Link href="/campaigns">
                    <Button size="sm" variant="outline">
                      View drafts
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pl-5 pr-3 font-semibold">Campaign</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Sent</th>
                    <th className="px-3 py-2 text-right font-semibold">Delivery</th>
                    <th className="px-3 py-2 text-right font-semibold">Replies</th>
                    <th className="py-2 pl-3 pr-5 text-right font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignsWithActivity.map((c) => (
                    <tr
                      key={c.id}
                      className="group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="py-3 pl-5 pr-3">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="text-[13px] font-medium text-foreground transition-colors group-hover:text-primary"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] tabular-nums text-foreground">
                        {formatNumber(c.sent)}
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] tabular-nums text-foreground">
                        {formatPercent(c.deliveryRate)}
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] tabular-nums text-foreground">
                        {formatNumber(c.replies)}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right text-[12px] text-muted-foreground">
                        {formatShortDate(c.sentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {metrics.upcomingScheduled.length > 0 && (
            <section className="surface rounded-xl bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
                  Upcoming scheduled
                </h2>
                <Link
                  href="/campaigns/scheduled"
                  className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  View schedule
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="space-y-2">
                {metrics.upcomingScheduled.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-primary">
                      {c.name}
                    </Link>
                    <span className="shrink-0 text-muted-foreground">
                      {new Date(c.scheduledAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Needs attention */}
          <section className="surface rounded-xl bg-card p-5">
            <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
              Needs Attention
            </h2>
            <ul className="mt-3 space-y-1">
              {attentionItems.map((item) => {
                const Icon = item.tone === "ok" ? CheckCircle2 : AlertCircle;
                const inner = (
                  <>
                    <Icon
                      className={cn(
                        "mt-px h-4 w-4 shrink-0",
                        item.tone === "ok" ? "text-emerald-600" : "text-amber-600",
                      )}
                    />
                    <span className="flex-1 text-[13px] font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.href ? (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
                    ) : null}
                  </>
                );
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2.5 px-2.5 py-2">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Recent replies */}
          <section className="surface flex-1 rounded-xl bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
                Recent Replies
              </h2>
              <Link
                href="/conversations"
                className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Open inbox
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {metrics.recentReplies.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageSquare className="h-4.5 w-4.5" />
                </div>
                <p className="mt-3 text-[13px] font-semibold text-foreground">No replies yet</p>
                <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
                  When contacts respond to your campaigns, they’ll show up here.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {metrics.recentReplies.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/conversations?conversation=${encodeURIComponent(r.conversationId)}`}
                      className="group flex items-start gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {r.contactName
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase())
                          .join("") || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {r.contactName}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatShortDate(r.at)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                          {r.preview}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
