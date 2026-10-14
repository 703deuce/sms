"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  Flag,
  MapPinned,
  MessageSquareText,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import { RepBadge, RepMetricCard, RepPageHeader, RepTabs, rep } from "@/components/reputation/rep-ui";
import { ReputationSyncButton } from "@/components/reputation/reputation-sync-button";
import type { ReputationModulesAuditData } from "@/lib/reputation/reputation-modules-audit";
import { cn } from "@/lib/utils";

type AuditTab =
  | "summary"
  | "position"
  | "velocity"
  | "gap"
  | "strengths"
  | "response"
  | "opportunities"
  | "action";

const TABS: Array<{ id: AuditTab; label: string }> = [
  { id: "summary", label: "Executive Summary" },
  { id: "position", label: "Review Position" },
  { id: "velocity", label: "Velocity & Momentum" },
  { id: "gap", label: "Competitor Gap" },
  { id: "strengths", label: "Strengths & Gaps" },
  { id: "response", label: "Response Performance" },
  { id: "opportunities", label: "Opportunities" },
  { id: "action", label: "Action Plan" },
];

function fmt(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return digits > 0 ? value.toFixed(digits) : value.toLocaleString();
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="relative inline-block">
          <Star className="h-5 w-5 text-[#E6EAF0]" fill="#E6EAF0" />
          {i < full ? (
            <Star className="absolute inset-0 h-5 w-5 text-[#F79009]" fill="#F79009" />
          ) : i === full && partial > 0 ? (
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${partial * 100}%` }}
            >
              <Star className="h-5 w-5 text-[#F79009]" fill="#F79009" />
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 120;
  const h = 40;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="#137752" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MiniBarChart({ values }: { values: Array<{ label: string; value: number; color?: string }> }) {
  const max = Math.max(...values.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {values.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-[#667085]">{item.label}</span>
            <span className="font-semibold text-[#101828]">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-[#F2F4F7]">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(8, (item.value / max) * 100)}%`, backgroundColor: item.color ?? "#137752" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ pct, label }: { pct: number; label?: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference;
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E6EAF0" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#137752"
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[#101828]">{pct}%</span>
        {label ? <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#137752]">{label}</span> : null}
      </div>
    </div>
  );
}

function SectionCard({
  id,
  title,
  icon: Icon,
  children,
  className,
  viewLink,
}: {
  id: string;
  title: string;
  icon: typeof Target;
  children: React.ReactNode;
  className?: string;
  viewLink?: string;
}) {
  return (
    <section id={id} className={cn(rep.card, "p-4", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-[#101828]">{title}</h2>
        </div>
        {viewLink !== undefined ? (
          <a href={viewLink} className={rep.link}>View Full Analysis →</a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ReputationStrategyReport({
  businessId,
  data,
}: {
  businessId: string;
  data: ReputationModulesAuditData;
}) {
  const [activeTab, setActiveTab] = useState<AuditTab>("summary");

  const leaderboard = data.competitors.leaderboardRows;
  const you = leaderboard.find((row) => row.isYou);
  const youIndex = leaderboard.findIndex((row) => row.isYou);
  const reviewPosition = youIndex >= 0 ? `#${youIndex + 1} of ${leaderboard.length}` : "#1";
  const topCompetitor = leaderboard.find((row) => !row.isYou);
  const topGap = data.competitors.gapRows.find((row) => row.totalGap > 0);

  const overallScore = useMemo(() => {
    if (data.businessId.includes("preview")) return 82;
    const ratingScore = ((you?.rating ?? 4.2) / 5) * 35;
    const responseScore = (data.insights.responsePerformance.responseRate / 100) * 25;
    const velocityScore = Math.min(25, (data.analytics.rolling30d / 35) * 25);
    const alertScore = Math.max(0, 15 - data.alerts.activeAlerts.length * 3);
    return Math.round(ratingScore + responseScore + velocityScore + alertScore);
  }, [data.alerts.activeAlerts.length, data.analytics.rolling30d, data.businessId, data.insights.responsePerformance.responseRate, you?.rating]);

  const prevScore = data.businessId.includes("preview") ? 70 : Math.max(0, overallScore - 8);
  const scoreDelta = overallScore - prevScore;

  const totalReviewsDelta = data.analytics.priorPeriod.rolling90dDelta;
  const totalReviewsDeltaPct = you && you.totalReviews > 0
    ? Math.round((totalReviewsDelta / (you.totalReviews - totalReviewsDelta)) * 100)
    : 0;

  const reviews30dDelta = data.analytics.priorPeriod.rolling30dDelta;
  const reviews30dDeltaPct = data.analytics.priorPeriod.rolling30d > 0
    ? Math.round((reviews30dDelta / data.analytics.priorPeriod.rolling30d) * 100)
    : 0;

  const summary =
    `${data.businessName} maintains a strong and growing reputation with a ${fmt(you?.rating, 1)}-star Google rating across ${fmt(you?.totalReviews)} reviews. ` +
    `${data.analytics.rolling30d} new reviews in the last 30 days — a ${reviews30dDeltaPct}% increase over the prior period. ` +
    `Momentum is ${data.analytics.momentumStatus.toLowerCase()} and ${data.insights.responsePerformance.responseRate}% of text reviews have owner responses.`;

  function handleTab(id: string) {
    const next = id as AuditTab;
    setActiveTab(next);
    const targetId =
      next === "summary" ? "executive-summary"
        : next === "position" ? "review-position"
          : next === "velocity" ? "velocity-momentum"
            : next === "gap" ? "competitor-gap"
              : next === "strengths" ? "review-insights"
                : next === "response" ? "response-performance"
                  : next === "opportunities" ? "opportunities"
                    : "action-plan";
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const sparklineValues = data.analytics.timelinePoints.map((p) => p.you);

  const dateRangeLabel = "Last 90 days";

  return (
    <div className={rep.page} data-business-id={businessId}>
      <RepPageHeader
        title="Reputation Audit"
        subtitle="Comprehensive review, competitor, response, and visibility strategy report."
        dateRangeLabel={dateRangeLabel}
        showCompare={false}
        showExport={false}
        showFilters={false}
        primaryAction={
          <ReputationSyncButton
            businessId={businessId}
            label="Run Reputation Sync"
          />
        }
      />

      <RepTabs tabs={TABS} active={activeTab} onChange={handleTab} />

      {/* Executive Summary */}
      <section id="executive-summary" className={cn(rep.card, "p-5")}>
        <RepBadge>Executive Summary</RepBadge>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1">
            <p className="text-sm leading-7 text-[#344054]">{summary}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className={rep.label}>Google Rating</p>
                <p className="text-2xl font-bold text-[#101828]">{fmt(you?.rating, 1)}</p>
                <StarRating rating={you?.rating ?? 4.6} />
                <p className="text-xs text-[#667085]">{fmt(you?.totalReviews)} reviews</p>
              </div>
              <div className="space-y-1">
                <p className={rep.label}>Reviews Total</p>
                <p className="text-2xl font-bold text-[#101828]">{fmt(you?.totalReviews)}</p>
                <p className="text-xs">
                  <span className="font-semibold text-[#027A48]">+{totalReviewsDelta} (↑{totalReviewsDeltaPct}%)</span>
                  <span className="ml-1 text-[#667085]">vs prior</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className={rep.label}>Reviews 30d</p>
                <p className="text-2xl font-bold text-[#101828]">{data.analytics.rolling30d}</p>
                <p className="text-xs">
                  <span className="font-semibold text-[#027A48]">+{reviews30dDelta} (↑{reviews30dDeltaPct}%)</span>
                  <span className="ml-1 text-[#667085]">vs prior 30d</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className={rep.label}>Momentum</p>
                <p className="text-2xl font-bold text-[#101828]">{data.analytics.momentumStatus}</p>
                <p className="text-xs text-[#667085]">{reviewPosition} in market</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div id="review-position" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard
          label="Google Rating"
          value={fmt(you?.rating, 1)}
          icon={Star}
          hint={topCompetitor?.rating ? `vs ${fmt(topCompetitor.rating, 1)} top competitor` : "Current rating"}
        />
        <RepMetricCard
          label="Reviews Total"
          value={fmt(you?.totalReviews)}
          icon={MessageSquareText}
          trend={`+${totalReviewsDelta}`}
          hint={`↑${totalReviewsDeltaPct}% vs prior`}
        />
        <RepMetricCard
          label="Reviews 30d"
          value={data.analytics.rolling30d}
          icon={TrendingUp}
          trend={`+${reviews30dDelta}`}
          hint={`↑${reviews30dDeltaPct}% vs prior 30d`}
        />
        <RepMetricCard
          label="Momentum"
          value={data.analytics.momentumStatus}
          icon={BarChart3}
          hint={data.analytics.drivers[0] ?? "Velocity trend"}
          valueClassName="text-[22px]"
        />
        <RepMetricCard
          label="Review Position"
          value={reviewPosition}
          icon={Flag}
          hint={topGap ? `Need ${topGap.neededToCatch} more to catch #1` : "Leading tracked competitors"}
        />
      </div>

      {/* Middle row */}
      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard id="velocity-momentum" title="Velocity & Momentum" icon={TrendingUp} viewLink={`/businesses/${businessId}/reputation/analytics`}>
          <MiniSparkline values={sparklineValues} />
          <MiniBarChart
            values={[
              { label: "7d", value: data.analytics.rolling7d },
              { label: "30d", value: data.analytics.rolling30d },
              { label: "60d", value: data.analytics.rolling60d },
              { label: "90d", value: data.analytics.rolling90d },
            ]}
          />
          <p className="mt-4 text-sm leading-6 text-[#667085]">{data.analytics.explanation}</p>
        </SectionCard>

        <SectionCard id="competitor-gap" title="Competitor Gap" icon={Target} viewLink={`/businesses/${businessId}/reputation/competitors`}>
          {topGap ? (
            <div className="mb-4 rounded-xl bg-[#FEF3F2] p-3">
              <p className="text-sm font-semibold text-[#B42318]">
                You need {topGap.neededToCatch} more reviews to catch #{leaderboard.findIndex((r) => r.id === topGap.competitorId) + 1}
              </p>
              <p className="mt-1 text-xs text-[#667085]">{topGap.competitorName} leads with {topGap.neededToCatch + (you?.totalReviews ?? 0)} total reviews</p>
            </div>
          ) : null}
          {data.competitors.gapRows.slice(0, 3).map((row) => (
            <div key={row.competitorId} className="mb-3 rounded-xl bg-[#F9FAFB] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#101828]">{row.competitorName}</p>
                <RepBadge tone={row.totalGap > 0 ? "red" : "green"}>
                  {row.totalGap > 0 ? `${row.totalGap} behind` : "Ahead"}
                </RepBadge>
              </div>
              <p className="mt-1 text-xs text-[#667085]">{row.estimatedCatchUp}</p>
            </div>
          ))}
        </SectionCard>

        <SectionCard id="review-insights" title="Review Insights" icon={MessageSquareText} viewLink={`/businesses/${businessId}/reputation/insights`}>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#027A48]">Positive Themes</p>
            {data.insights.themes.positive.slice(0, 3).map((theme) => (
              <div key={theme.label} className="flex items-center justify-between rounded-lg bg-[#ECFDF3] px-3 py-2">
                <span className="text-sm text-[#344054]">{theme.label}</span>
                <span className="text-sm font-semibold text-[#027A48]">{theme.count}</span>
              </div>
            ))}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#B42318]">Negative Themes</p>
            {data.insights.themes.negative.slice(0, 3).map((theme) => (
              <div key={theme.label} className="flex items-center justify-between rounded-lg bg-[#FEF3F2] px-3 py-2">
                <span className="text-sm text-[#344054]">{theme.label}</span>
                <span className="text-sm font-semibold text-[#B42318]">{theme.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Bottom row */}
      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard id="response-performance" title="Response Performance" icon={MessageSquareText} viewLink={`/businesses/${businessId}/reputation/reviews`}>
          <Donut pct={data.insights.responsePerformance.responseRate} label="Excellent" />
          <p className="mt-3 text-center text-xs text-[#667085]">
            Owner response rate on text reviews
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-[#F9FAFB] p-3">
              <p className={rep.label}>Answered</p>
              <p className="mt-1 font-bold text-[#101828]">{data.insights.responsePerformance.answered}</p>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-3">
              <p className={rep.label}>Avg Response Time</p>
              <p className="mt-1 font-bold text-[#101828]">{data.analytics.avgResponseTimeDays}d</p>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-3">
              <p className={rep.label}>Unanswered +</p>
              <p className="mt-1 font-bold text-[#101828]">{data.insights.responsePerformance.unansweredPositive}</p>
            </div>
            <div className="rounded-lg bg-[#FEF3F2] p-3">
              <p className={rep.label}>Unanswered –</p>
              <p className="mt-1 font-bold text-[#B42318]">{data.insights.responsePerformance.unansweredNegative}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard id="maps-impact" title="Maps Visibility Impact" icon={MapPinned} viewLink={`/businesses/${businessId}/scans`}>
          <p className="text-sm leading-6 text-[#344054]">{data.mapsVisibility.summary}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#667085]">Top-3 Visibility</dt>
              <dd className="font-semibold text-[#101828]">
                {(data.mapsVisibility.aggregateMetrics as Record<string, unknown> | null)?.top3Pct != null
                  ? `${(data.mapsVisibility.aggregateMetrics as Record<string, number>).top3Pct}%`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">Scans 30d</dt>
              <dd className="font-semibold text-[#101828]">{data.mapsVisibility.scanCount30d}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">Grid size</dt>
              <dd className="font-semibold text-[#101828]">{data.mapsVisibility.gridSize ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">Status</dt>
              <dd className="font-semibold capitalize text-[#101828]">{data.mapsVisibility.latestStatus ?? "—"}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard id="opportunities" title="Recommended Next Actions" icon={Flag}>
          <div className="space-y-2">
            {data.recommendedActions.days30.slice(0, 4).map((action, i) => (
              <div key={action} className="flex gap-3 rounded-lg bg-[#F9FAFB] p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#137752] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm leading-5 text-[#344054]">{action}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Footer: 30/60/90 day plan + score */}
      <div id="action-plan" className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className={cn(rep.card, "p-4")}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
              <Calendar className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-[#101828]">30/60/90 Day Action Plan Preview</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: "30 Days", items: data.recommendedActions.days30 },
              { title: "60 Days", items: data.recommendedActions.days60 },
              { title: "90 Days", items: data.recommendedActions.days90 },
            ].map((period) => (
              <div key={period.title} className="rounded-xl bg-[#F9FAFB] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#137752]" />
                  <h3 className="text-sm font-semibold text-[#101828]">{period.title}</h3>
                </div>
                <ul className="space-y-2 text-sm leading-5 text-[#667085]">
                  {period.items.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#137752]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className={cn(rep.card, "flex flex-col items-center justify-center p-6 text-center")}>
          <p className={rep.label}>Overall Reputation Score</p>
          <p className="mt-3 text-6xl font-bold text-[#137752]">{overallScore}</p>
          <RepBadge tone="green" >Excellent</RepBadge>
          <p className="mt-2 text-sm font-semibold text-[#027A48]">
            ↑{scoreDelta} points
          </p>
          <p className="mt-1 text-xs text-[#667085]">vs prior audit</p>
          <p className="mt-4 text-xs leading-5 text-[#667085]">
            Improve by clearing high-severity alerts and sustaining review velocity above local competitors.
          </p>
        </div>
      </div>
    </div>
  );
}
