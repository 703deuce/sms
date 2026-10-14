"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  MessageSquare,
  Shield,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { MessagingSetupCallout } from "@/components/messaging/messaging-setup-callout";
import {
  RepAreaTrendChart,
} from "@/components/reputation/rep-charts";
import { ReputationSyncButton } from "@/components/reputation/reputation-sync-button";
import { Sparkline } from "@/components/overview/overview-charts";
import {
  ModulePage,
  cardClass,
  moduleStack,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-preview-data";

const GREEN = "#137752";
const GREEN_SOFT = "#ECFDF3";
const BLUE = "#3B82F6";
const GREY_LINE = "#A1A1AA";

function YellowStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              filled ? "fill-[#FDB022] text-[#FDB022]" : "fill-zinc-200 text-zinc-200"
            )}
          />
        );
      })}
    </span>
  );
}

function DeltaPct({ value, suffix }: { value: number; suffix: string }) {
  const positive = value >= 0;
  return (
    <p className={cn("mt-1 text-[11px] font-medium leading-snug", positive ? "text-emerald-600" : "text-red-600")}>
      {positive ? "+" : ""}
      {value}% {suffix}
    </p>
  );
}

function SoftCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, "p-4", className)}>{children}</div>;
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{children}</p>
  );
}

function ViewLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#137752] hover:underline"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function ResponseRing({ pct, showLabel = false }: { pct: number; showLabel?: boolean }) {
  const size = 52;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E4E4E7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={GREEN}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold tabular-nums text-zinc-900">{Math.round(clamped)}%</span>
        </div>
      ) : null}
    </div>
  );
}

function ClickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9 9l5.5 12 1.7-5.3L21.5 14.5 9 9z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M4 4l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return digits > 0 ? n.toFixed(digits) : String(n);
}

function signedDelta(n: number | null | undefined, digits = 0, suffix = ""): string | null {
  if (n == null || Number.isNaN(n)) return null;
  const abs = digits > 0 ? Math.abs(n).toFixed(digits) : String(Math.abs(n));
  return `${n >= 0 ? "+" : "-"}${abs}${suffix}`;
}

function nextActionHref(businessId: string, ctaLabel: string): string {
  const label = ctaLabel.toLowerCase();
  if (label.includes("respond") || label.includes("unanswered")) {
    return `/businesses/${businessId}/reputation/reviews?tab=unanswered`;
  }
  if (label.includes("request")) {
    return `/businesses/${businessId}/reputation/requests`;
  }
  if (label.includes("momentum") || label.includes("action plan") || label.includes("sync") || label.includes("analytics")) {
    return `/businesses/${businessId}/reputation/analytics`;
  }
  return `/businesses/${businessId}/reputation/reviews`;
}

export function ReviewOverviewDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewOverviewData;
}) {
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const analyticsHref = `/businesses/${businessId}/reputation/analytics`;
  const competitorsHref = `/businesses/${businessId}/reputation/competitors`;
  const mapsHref = `/businesses/${businessId}/scans`;
  const campaignsHref = `/businesses/${businessId}/reputation/campaigns`;
  const unansweredHref = `/businesses/${businessId}/reputation/reviews?tab=unanswered`;
  const actionHref = nextActionHref(businessId, data.nextAction.ctaLabel);
  const showMomentumArrow =
    data.momentumLabel === "Accelerating" ||
    data.momentumLabel === "Exploding" ||
    data.momentumLabel === "Healthy" ||
    data.momentumLabel === "Recovering";

  return (
    <ModulePage className={moduleStack}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Review Overview</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-sm"
          >
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            {data.dateRangeLabel}
          </button>
          <Link
            href={`/businesses/${businessId}/reports`}
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Show Report
          </Link>
          <ReputationSyncButton
            businessId={businessId}
            label="Refresh Reputation Data"
          />
        </div>
      </div>

      <MessagingSetupCallout businessId={businessId} />

      {/* Row 1 — six KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <SoftCard>
          <CardLabel>Google Rating</CardLabel>
          <div className="mt-1.5 flex items-end gap-2">
            <span className="text-2xl font-bold tabular-nums leading-none text-zinc-900">
              {fmtNum(data.googleRating, 1)}
            </span>
            {data.googleRating != null ? <YellowStars rating={data.googleRating} /> : null}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
            {data.competitorAvgRatingNearby != null
              ? `vs ${data.competitorAvgRatingNearby.toFixed(1)} avg in ${data.nearbyMiles} mi`
              : data.hasReviewsData
                ? "No nearby competitor rating yet"
                : "Sync reviews to unlock"}
          </p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Total Reviews</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.totalReviews}
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-emerald-600">
            + {data.gained30d} in last 30 days
          </p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (7 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews7d}
          </p>
          <DeltaPct value={data.reviews7dDeltaPct} suffix="vs previous 7 days" />
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (30 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews30d}
          </p>
          <DeltaPct value={data.reviews30dDeltaPct} suffix="vs previous 30 days" />
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (60 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews60d}
          </p>
          <DeltaPct value={data.reviews60dDeltaPct} suffix="vs previous 60 days" />
        </SoftCard>

        <SoftCard>
          <CardLabel>Reviews (90 Days)</CardLabel>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.reviews90d}
          </p>
          <DeltaPct value={data.reviews90dDeltaPct} suffix="vs previous 90 days" />
        </SoftCard>
      </div>

      {/* Row 2 — insight cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <SoftCard>
          <CardLabel>Review Velocity</CardLabel>
          <div className="mt-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-bold tabular-nums leading-tight text-zinc-900">
                {data.reviewsPerWeek} reviews / week
              </p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-700">
                {data.reviewsPerMonth} reviews / month
              </p>
            </div>
            {data.velocitySparkline.length > 1 ? (
              <Sparkline data={data.velocitySparkline} color={GREEN} width={64} height={28} />
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">
            vs {data.reviewsPerWeekBaseline90d} avg last 90 days
          </p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Momentum</CardLabel>
          <div
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold",
              data.momentumLabel === "Slowing" || data.momentumLabel === "Stalled"
                ? "bg-amber-50 text-amber-800"
                : "bg-[#ECFDF3] text-[#137752]"
            )}
          >
            {showMomentumArrow ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
            {data.momentumLabel}
          </div>
          <p className="mt-2 text-[12px] font-medium text-zinc-700">{data.momentumSubtitle}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{data.momentumDetail}</p>
        </SoftCard>

        <SoftCard>
          <CardLabel>Competitor Position</CardLabel>
          <p className="mt-2 text-2xl font-bold tabular-nums leading-none text-zinc-900">
            {data.competitorRank != null ? (
              <>
                #{data.competitorRank}{" "}
                <span className="text-base font-semibold text-zinc-500">
                  of {data.competitorPoolSize ?? "—"}
                </span>
              </>
            ) : (
              "—"
            )}
          </p>
          {data.competitorRankDelta != null ? (
            <p
              className={cn(
                "mt-1.5 text-[11px] font-medium",
                data.competitorRankDelta >= 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {data.competitorRankDelta >= 0 ? "+" : ""}
              {data.competitorRankDelta} vs last run
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-zinc-500">Ranked by 90-day reviews</p>
          )}
          <div className="mt-2">
            <ViewLink href={competitorsHref}>View Rankings</ViewLink>
          </div>
        </SoftCard>

        <SoftCard>
          <CardLabel>Response Rate</CardLabel>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-bold tabular-nums leading-none text-zinc-900">
              {data.answeredOf > 0 ? `${data.responseRatePct}%` : "—"}
            </span>
            {data.answeredOf > 0 ? <ResponseRing pct={data.responseRatePct} /> : null}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">
            {data.answeredOf > 0
              ? `${data.answeredCount} of ${data.answeredOf} reviews answered`
              : "No written reviews in the last 90 days"}
          </p>
        </SoftCard>

        <SoftCard
          className={cn(
            data.unansweredNegative > 0 && "border-red-100 bg-gradient-to-br from-white to-red-50/40"
          )}
        >
          <CardLabel>Unanswered Negative</CardLabel>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "text-3xl font-bold tabular-nums leading-none",
                data.unansweredNegative > 0 ? "text-red-600" : "text-zinc-900"
              )}
            >
              {data.unansweredNegative}
            </span>
            {data.unansweredNegative > 0 ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1.5 text-[11px] font-medium",
              data.unansweredNegative > 0 ? "text-red-600" : "text-zinc-500"
            )}
          >
            {data.unansweredNegative > 0 ? "Needs immediate response" : "All negatives answered"}
          </p>
          <div className="mt-2">
            <ViewLink href={unansweredHref}>View Reviews</ViewLink>
          </div>
        </SoftCard>
      </div>

      {/* Row 3 — charts + lists */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <SoftCard className="xl:col-span-1">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold text-zinc-900">Review Trend (90 days)</h2>
            </div>
            <ViewLink href={analyticsHref}>View Review Velocity</ViewLink>
          </div>
          {data.trendSeries.length > 0 ? (
            <RepAreaTrendChart
              data={data.trendSeries}
              xKey="label"
              height={200}
              series={[
                { dataKey: "you", name: "You", color: GREEN },
                { dataKey: "benchmark", name: "Benchmark", color: BLUE, fillOpacity: 0.12 },
                { dataKey: "competitor", name: "Competitor", color: GREY_LINE, dashed: true, fillOpacity: 0.04 },
              ]}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-[13px] text-zinc-500">
                Run Review Momentum to plot your 90-day trend.
              </p>
              <ReputationSyncButton
                businessId={businessId}
                label="Run Review Momentum"
              />
            </div>
          )}
        </SoftCard>

        <SoftCard>
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">
              Review Impact vs Competitors (90 days)
            </h2>
            <ViewLink href={competitorsHref}>See All Competitors</ViewLink>
          </div>
          {data.impactRows.length > 0 ? (
            <ul className="space-y-3.5">
              {data.impactRows.map((row) => (
                <li key={row.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <div className="min-w-0 truncate">
                      <span
                        className={cn(
                          "text-[13px] font-semibold",
                          row.isYou ? "text-zinc-900" : "text-zinc-700"
                        )}
                      >
                        {row.name}
                      </span>
                      <span className="ml-1.5 text-[12px] font-bold tabular-nums text-zinc-900">
                        +{row.reviewsGained} reviews
                      </span>
                      {row.status ? (
                        <span
                          className={cn(
                            "ml-1.5 text-[11px] font-medium",
                            row.isYou ? "text-emerald-600" : "text-zinc-500"
                          )}
                        >
                          ({row.status})
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        row.isYou ? "bg-[#137752]" : "bg-zinc-300"
                      )}
                      style={{ width: `${row.barPct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-[13px] text-zinc-500">
              Competitor impact appears after a momentum run.
            </p>
          )}
        </SoftCard>

        <SoftCard>
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">Maps Visibility (30 days)</h2>
            <ViewLink href={mapsHref}>View Full Maps Profile</ViewLink>
          </div>
          {data.hasMapsData ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-zinc-500">Avg Ranking</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-zinc-900">
                    {fmtNum(data.mapsAvgRank, 1)}
                  </p>
                  {signedDelta(data.mapsAvgRankDelta, 1, " in last 30 days") ? (
                    <p
                      className={cn(
                        "mt-1 text-[11px] font-medium",
                        (data.mapsAvgRankDelta ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {signedDelta(data.mapsAvgRankDelta, 1, " in last 30 days")}
                    </p>
                  ) : null}
                </div>
                {data.mapsRankSparkline.length > 1 ? (
                  <Sparkline data={data.mapsRankSparkline} color={GREEN} width={88} height={36} />
                ) : null}
              </div>
              <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-zinc-600">Top 3 Visibility</span>
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {fmtNum(data.top3VisibilityPct)}%{" "}
                    {data.top3VisibilityDelta != null ? (
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          data.top3VisibilityDelta >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {data.top3VisibilityDelta >= 0 ? "+" : ""}
                        {data.top3VisibilityDelta}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-zinc-600">Top 10 Visibility</span>
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {fmtNum(data.top10VisibilityPct)}%{" "}
                    {data.top10VisibilityDelta != null ? (
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          data.top10VisibilityDelta >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {data.top10VisibilityDelta >= 0 ? "+" : ""}
                        {data.top10VisibilityDelta}%
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-[13px] text-zinc-500">
              Run a Maps scan to unlock visibility metrics.
            </p>
          )}
        </SoftCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
        <SoftCard className="xl:col-span-3">
          <div className="mb-4 flex items-start justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-zinc-900">
              Campaign Performance (Last 30 days)
            </h2>
            <ViewLink href={campaignsHref}>View All Campaigns</ViewLink>
          </div>
          {data.hasCampaignData || data.campaign.sent > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <CampaignStat
                icon={<MessageSquare className="h-4 w-4" />}
                value={String(data.campaign.sent)}
                label="Sent"
              />
              <CampaignStat
                icon={<ClickIcon className="h-4 w-4" />}
                value={`${data.campaign.clickedPct}%`}
                label={`(${data.campaign.clickedCount}) Clicked`}
              />
              <CampaignStat
                icon={<Star className="h-4 w-4" />}
                value={String(data.campaign.reviews)}
                label="reviews"
              />
              <CampaignStat
                icon={<Shield className="h-4 w-4" />}
                value={String(data.campaign.badReviews)}
                label="bad reviews"
              />
              <CampaignStat
                icon={<Trophy className="h-4 w-4" />}
                value={`${data.campaign.convRatePct}%`}
                label="Conv. Rate"
              />
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] text-zinc-500">
              No campaign sends in the last 30 days.{" "}
              <Link href={`/businesses/${businessId}/reputation/requests`} className="font-semibold text-[#137752] hover:underline">
                Send a review request
              </Link>
            </p>
          )}
        </SoftCard>

        {!suggestionDismissed ? (
          <SoftCard className="border-[#D1FAE5] bg-gradient-to-br from-[#ECFDF3]/80 to-white xl:col-span-2">
            <div className="flex gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: GREEN_SOFT, color: GREEN }}
              >
                <Zap className="h-5 w-5 fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Recommended Next Action
                </p>
                <h3 className="mt-1 text-[15px] font-bold text-zinc-900">{data.nextAction.title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-zinc-600">{data.nextAction.body}</p>
                <Link
                  href={actionHref}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#137752] px-4 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.28)] hover:bg-[#0f6244] sm:w-auto"
                >
                  {data.nextAction.ctaLabel}
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  className="mt-2 block text-[12px] font-medium text-zinc-500 hover:text-zinc-700"
                  onClick={() => setSuggestionDismissed(true)}
                >
                  Dismiss Suggestion
                </button>
              </div>
            </div>
          </SoftCard>
        ) : null}
      </div>
    </ModulePage>
  );
}

function CampaignStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: GREEN_SOFT, color: GREEN }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-bold tabular-nums leading-none text-zinc-900">{value}</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">{label}</p>
      </div>
    </div>
  );
}
