"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  MessageSquare,
  Plus,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import { RepHorizontalGapChart } from "@/components/reputation/rep-charts";
import { ReputationSyncButton } from "@/components/reputation/reputation-sync-button";
import { CompetitorReviewsWorkspace } from "@/components/reviews/competitor-reviews-workspace";
import type {
  CompetitorIntelligenceData,
  CompetitorLeaderboardRow,
} from "@/lib/reviews/competitor-intelligence-data";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import { cn } from "@/lib/utils";

const GREEN = "#137752";

type TabId = "overview" | "reviews" | "gaps" | "content" | "opportunities";

export type OpportunityItem = {
  icon: "check" | "star" | "chat";
  label: string;
};

export type PlatformPresenceItem = {
  platform: string;
  reviews: number;
  rating: number;
  status: "Connected" | "Estimated" | "Not Connected";
  verified: boolean;
  note?: string;
};

export type CatchUpForecastRow = {
  competitor: string;
  monthsToCatchUp: number | null;
  reviewsNeededPerMonth: number;
};

export type CompetitorIntelligenceDashboardData = Omit<CompetitorIntelligenceData, "leaderboardRows"> & {
  dateRangeLabel?: string;
  requiredPaceOverride?: number;
  leaderboardRows: Array<
    CompetitorLeaderboardRow & {
      deltas?: {
        reviews30?: number;
        reviews60?: number;
        reviews90?: number;
      };
    }
  >;
  reviewsFeed: ReviewListItem[];
  opportunities?: string[];
  opportunityItems?: OpportunityItem[];
  platformPresence?: PlatformPresenceItem[];
  catchUpForecast?: CatchUpForecastRow[];
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "reviews", label: "Reviews" },
  { id: "gaps", label: "Gaps" },
  { id: "content", label: "Content" },
  { id: "opportunities", label: "Opportunities" },
];

function fmt(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function signed(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : "-"}${fmt(Math.abs(value), 0)}${suffix}`;
}

function Card({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(rep.card, "p-4", className)}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold text-[#101828]">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Rating({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="font-semibold tabular-nums text-[#98A2B3]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[#101828]">
      {fmt(value, 1)}
      <Star className="h-3.5 w-3.5 fill-[#FDB022] text-[#FDB022]" />
    </span>
  );
}

function MomentumPill({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const tone =
    lower.includes("acceler") || lower.includes("explod")
      ? "green"
      : lower.includes("slow") || lower.includes("stall")
        ? "amber"
        : lower.includes("recov")
          ? "blue"
          : "gray";
  return <RepBadge tone={tone}>{label}</RepBadge>;
}

function ResponseRing({ pct }: { pct: number }) {
  const size = 38;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E6EAF0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={GREEN}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#101828]">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function DeltaChip({ value }: { value: number | undefined }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold",
        positive ? "text-[#027A48]" : "text-[#B42318]"
      )}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {signed(value)}
    </span>
  );
}

function LeaderboardTable({
  rows,
  businessId,
}: {
  rows: CompetitorIntelligenceDashboardData["leaderboardRows"];
  businessId: string;
}) {
  return (
    <Card
      title="Full Leaderboard"
      subtitle="Ranked by total Google review count."
      action={
        <button
          type="button"
          onClick={() => {
            window.location.href = `/businesses/${businessId}/reputation/settings`;
          }}
          className={rep.btnSecondary}
        >
          <Plus className="h-4 w-4" />
          Add / Manage Competitors
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] text-left text-sm">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
            <tr>
              <th className="px-3 py-2 font-semibold">Rank</th>
              <th className="px-3 py-2 font-semibold">Business</th>
              <th className="px-3 py-2 font-semibold">Total</th>
              <th className="px-3 py-2 font-semibold">Rating</th>
              <th className="px-3 py-2 font-semibold">30d</th>
              <th className="px-3 py-2 font-semibold">60d</th>
              <th className="px-3 py-2 font-semibold">90d</th>
              <th className="px-3 py-2 font-semibold">Rev / mo</th>
              <th className="px-3 py-2 font-semibold">Momentum</th>
              <th className="px-3 py-2 font-semibold">Response</th>
              <th className="px-3 py-2 font-semibold">Avg Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn("border-b border-[#F2F4F7]", row.isYou && "bg-[#ECFDF3]")}
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tabular-nums text-[#101828]">#{index + 1}</span>
                    {!row.isYou && index === 0 ? (
                      <RepBadge tone="amber">Top Competitor</RepBadge>
                    ) : row.isYou && index <= 2 ? (
                      <RepBadge tone="green">Top 3</RepBadge>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                        row.isYou ? "bg-white text-[#137752]" : "bg-[#F2F4F7] text-[#667085]"
                      )}
                    >
                      {row.isYou ? "You" : row.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-[#101828]">{row.isYou ? "You" : row.name}</p>
                      {row.isYou ? (
                        <p className="text-xs text-[#667085]">{row.name}</p>
                      ) : (
                        <p className="text-xs text-[#98A2B3]">({fmt(row.totalReviews)} total)</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums text-[#101828]">{fmt(row.totalReviews)}</td>
                <td className="px-3 py-3"><Rating value={row.rating} /></td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">
                  {row.reviews30}
                  <DeltaChip value={row.deltas?.reviews30} />
                </td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">
                  {row.reviews60}
                  <DeltaChip value={row.deltas?.reviews60} />
                </td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">
                  {row.reviews90}
                  <DeltaChip value={row.deltas?.reviews90} />
                </td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.reviewsPerMonth, 1)}</td>
                <td className="px-3 py-3"><MomentumPill label={row.momentumLabel} /></td>
                <td className="px-3 py-3"><ResponseRing pct={row.responseRate} /></td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">
                  {row.responseSpeedDaysAvg == null ? "—" : `${fmt(row.responseSpeedDaysAvg, 1)}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type GapMode = "total" | "velocity";

function GapAnalysisChart({
  rows,
  mode,
}: {
  rows: CompetitorIntelligenceDashboardData["leaderboardRows"];
  mode: GapMode;
}) {
  const chartRows = rows.slice(0, 6).map((row) => ({
    id: row.id,
    name: row.isYou ? "You" : row.name,
    value: mode === "total" ? row.totalReviews : row.reviews30,
    isYou: row.isYou,
  }));

  return (
    <RepHorizontalGapChart rows={chartRows} height={200} />
  );
}

function GapWidgets({ data }: { data: CompetitorIntelligenceDashboardData }) {
  const [gapMode, setGapMode] = useState<GapMode>("total");
  const you = data.leaderboardRows.find((row) => row.isYou);

  const forecastRows = data.catchUpForecast ?? data.gapRows.slice(0, 4).map((row) => ({
    competitor: row.competitorName,
    monthsToCatchUp: row.estimatedCatchUpMonths,
    reviewsNeededPerMonth: Math.max(
      you?.reviews30 ?? 0,
      (you?.reviews30 ?? 0) + (row.monthlyVelocityGap > 0 ? row.monthlyVelocityGap + 1 : 1)
    ),
  }));

  const oppItems = data.opportunityItems ?? (data.opportunities ?? data.positioningOpportunities.map((item) => item.title)).slice(0, 5).map((label) => ({
    icon: "check" as const,
    label: typeof label === "string" ? label : label,
  }));

  const OppIcon = ({ icon }: { icon: OpportunityItem["icon"] }) => {
    if (icon === "star") return <Star className="h-4 w-4 shrink-0 text-[#137752]" />;
    if (icon === "chat") return <MessageSquare className="h-4 w-4 shrink-0 text-[#137752]" />;
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-[#137752]" />;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card
        title="Review Gap Analysis"
        subtitle="Total review count by competitor."
        action={
          <div className="flex rounded-lg bg-[#F2F4F7] p-0.5">
            {(["total", "velocity"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGapMode(mode)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold",
                  gapMode === mode ? "bg-white text-[#137752] shadow-sm" : "text-[#667085]"
                )}
              >
                {mode === "total" ? "Total Reviews Gap" : "Velocity Gap (30d)"}
              </button>
            ))}
          </div>
        }
      >
        <GapAnalysisChart rows={data.leaderboardRows} mode={gapMode} />
      </Card>

      <Card title="Catch-Up Forecast" subtitle="Projected months to reach each competitor.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <tr>
                <th className="py-2 font-semibold">Competitor</th>
                <th className="py-2 font-semibold">Months</th>
                <th className="py-2 font-semibold">Reviews / mo</th>
              </tr>
            </thead>
            <tbody>
              {forecastRows.slice(0, 4).map((row) => (
                <tr key={row.competitor} className="border-t border-[#F2F4F7]">
                  <td className="py-3 font-medium text-[#101828]">{row.competitor}</td>
                  <td className="py-3 tabular-nums text-[#344054]">
                    {row.monthsToCatchUp == null ? (
                      <span className="text-[#667085]">Not at this pace</span>
                    ) : row.monthsToCatchUp === 0 ? (
                      <RepBadge tone="green">Caught up</RepBadge>
                    ) : (
                      `${fmt(row.monthsToCatchUp, 1)} mo`
                    )}
                  </td>
                  <td className="py-3 tabular-nums text-[#344054]">{fmt(row.reviewsNeededPerMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Top Opportunities" subtitle="Where to close the gap fastest.">
        <div className="space-y-2">
          {oppItems.slice(0, 5).map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-3 text-sm text-[#344054]"
            >
              <OppIcon icon={item.icon} />
              <span>{item.label}</span>
            </div>
          ))}
          {you ? (
            <div className="rounded-xl bg-[#ECFDF3] p-3 text-sm text-[#027A48]">
              You are adding <strong>{fmt(you.reviews30)}</strong> reviews/month. Increase
              review requests to reach the target pace.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function StrengthsTab({ data }: { data: CompetitorIntelligenceDashboardData }) {
  const groups = [
    {
      title: "Your Strengths",
      items: data.strengths.positive,
      tone: "green" as const,
      description: "Themes mentioned positively in your reviews",
    },
    {
      title: "Your Weaknesses",
      items: data.strengths.negative,
      tone: "red" as const,
      description: "Themes mentioned negatively in your reviews",
    },
    {
      title: "Competitor Strengths",
      items: data.strengths.competitorPositive,
      tone: "blue" as const,
      description: "What competitors are praised for",
    },
    {
      title: "Competitor Weaknesses",
      items: data.strengths.competitorNegative,
      tone: "amber" as const,
      description: "Where competitors are criticized",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map(({ title, items, tone, description }) => (
        <Card key={title} title={title} subtitle={description}>
          <div className="space-y-1.5">
            {items.length === 0 ? (
              <p className="text-sm text-[#667085]">No review themes found yet.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tone === "green" ? "#137752" : tone === "red" ? "#B42318" : tone === "blue" ? "#3B82F6" : "#F79009" }}
                    />
                    <span className="font-medium text-[#344054]">{item.label}</span>
                  </div>
                  <RepBadge tone={tone}>{item.count} reviews</RepBadge>
                </div>
              ))
            )}
          </div>
        </Card>
      ))}
      <Card
        title="Service Gaps"
        subtitle="Competitor praise themes that appear less often in your reviews."
        className="lg:col-span-2"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <tr>
                <th className="px-3 py-2 font-semibold">Theme</th>
                <th className="px-3 py-2 font-semibold">Competitors</th>
                <th className="px-3 py-2 font-semibold">You</th>
                <th className="px-3 py-2 font-semibold">Gap</th>
                <th className="px-3 py-2 font-semibold">Opportunity</th>
              </tr>
            </thead>
            <tbody>
              {data.strengths.serviceGaps.map((row) => (
                <tr key={row.label} className="border-b border-[#F2F4F7]">
                  <td className="px-3 py-3 font-medium text-[#101828]">{row.label}</td>
                  <td className="px-3 py-3 tabular-nums text-[#344054]">{row.competitorMentions}</td>
                  <td className="px-3 py-3 tabular-nums text-[#344054]">{row.yourMentions}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-[#B42318]">+{row.gap}</td>
                  <td className="px-3 py-3">
                    <RepBadge tone="amber">High</RepBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ContentTab({ data }: { data: CompetitorIntelligenceDashboardData }) {
  const metrics = [
    { label: "Avg review length", you: `${data.contentComparison.you.avgLength} chars`, comp: `${data.contentComparison.competitors.avgLength} chars`, youBetter: data.contentComparison.you.avgLength > data.contentComparison.competitors.avgLength },
    { label: "% with text", you: `${data.contentComparison.you.pctWithText}%`, comp: `${data.contentComparison.competitors.pctWithText}%`, youBetter: data.contentComparison.you.pctWithText > data.contentComparison.competitors.pctWithText },
    { label: "Detailed reviews", you: `${data.contentComparison.you.pctDetailed}%`, comp: `${data.contentComparison.competitors.pctDetailed}%`, youBetter: data.contentComparison.you.pctDetailed > data.contentComparison.competitors.pctDetailed },
    { label: "Generic reviews", you: `${data.contentComparison.you.pctGeneric}%`, comp: `${data.contentComparison.competitors.pctGeneric}%`, youBetter: data.contentComparison.you.pctGeneric < data.contentComparison.competitors.pctGeneric },
    { label: "Location mentions", you: `${data.contentComparison.you.locationTerms}`, comp: `${data.contentComparison.competitors.locationTerms}`, youBetter: data.contentComparison.you.locationTerms > data.contentComparison.competitors.locationTerms },
    { label: "Service mentions", you: `${data.contentComparison.you.serviceTerms}`, comp: `${data.contentComparison.competitors.serviceTerms}`, youBetter: data.contentComparison.you.serviceTerms > data.contentComparison.competitors.serviceTerms },
    { label: "Employee mentions", you: `${data.contentComparison.you.employeeMentions}`, comp: `${data.contentComparison.competitors.employeeMentions}`, youBetter: data.contentComparison.you.employeeMentions > data.contentComparison.competitors.employeeMentions },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card title="Review Content Comparison" subtitle="How your review text quality compares with competitors.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <tr>
                <th className="px-3 py-2 font-semibold">Metric</th>
                <th className="px-3 py-2 font-semibold">You</th>
                <th className="px-3 py-2 font-semibold">Competitors</th>
                <th className="px-3 py-2 font-semibold">Edge</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((row) => (
                <tr key={row.label} className="border-b border-[#F2F4F7]">
                  <td className="px-3 py-3 font-medium text-[#101828]">{row.label}</td>
                  <td className={cn("px-3 py-3 tabular-nums font-semibold", row.youBetter ? "text-[#027A48]" : "text-[#344054]")}>{row.you}</td>
                  <td className="px-3 py-3 tabular-nums text-[#667085]">{row.comp}</td>
                  <td className="px-3 py-3">
                    <RepBadge tone={row.youBetter ? "green" : "gray"}>
                      {row.youBetter ? "You lead" : "Behind"}
                    </RepBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Your Top Praised Services">
          <div className="space-y-2">
            {data.strengths.frequentlyPraisedServices.map((item) => (
              <div key={item.term} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-sm">
                <span className="font-medium text-[#344054] capitalize">{item.term}</span>
                <RepBadge tone="green">{item.count} mentions</RepBadge>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Employee Mentions">
          <div className="space-y-2">
            {data.strengths.frequentlyMentionedEmployees.length > 0 ? (
              data.strengths.frequentlyMentionedEmployees.map((item) => (
                <div key={item.term} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-sm">
                  <span className="font-medium text-[#344054]">{item.term}</span>
                  <RepBadge tone="blue">{item.count} reviews</RepBadge>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#667085]">No employee mentions detected yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PlatformsTab({
  data,
  businessId,
}: {
  data: CompetitorIntelligenceDashboardData;
  businessId: string;
}) {
  const you = data.leaderboardRows.find((r) => r.isYou);
  const platforms = data.platformPresence ?? [
    {
      platform: "Google",
      reviews: you?.totalReviews ?? 0,
      rating: you?.rating ?? 0,
      status: "Connected" as const,
      verified: true,
      note: "Primary review source via Google Business Profile.",
    },
    {
      platform: "Facebook",
      reviews: 0,
      rating: 0,
      status: "Not Connected" as const,
      verified: false,
      note: "Not connected. Link Facebook in reputation settings when available.",
    },
    {
      platform: "Yelp",
      reviews: 0,
      rating: 0,
      status: "Not Connected" as const,
      verified: false,
      note: "Not connected. Link Yelp in reputation settings when available.",
    },
  ];

  const PLATFORM_COLORS: Record<string, string> = {
    Google: "#4285F4",
    Facebook: "#1877F2",
    Yelp: "#D32323",
  };

  return (
    <Card title="Platform Presence" subtitle="Review coverage across major platforms.">
      <div className="grid gap-4 md:grid-cols-3">
        {platforms.map((platform) => (
          <div
            key={platform.platform}
            className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: PLATFORM_COLORS[platform.platform] ?? "#667085" }}
                >
                  {platform.platform[0]}
                </span>
                <p className="font-semibold text-[#101828]">{platform.platform}</p>
              </div>
              <RepBadge tone={platform.verified ? "green" : "gray"}>
                {platform.status}
              </RepBadge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Reviews</p>
                <p className="mt-0.5 text-xl font-bold text-[#101828]">
                  {platform.verified ? platform.reviews : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Rating</p>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <p className="text-xl font-bold text-[#101828]">
                    {platform.verified && platform.rating > 0 ? platform.rating.toFixed(1) : "—"}
                  </p>
                  {platform.verified && platform.rating > 0 ? (
                    <Star className="h-4 w-4 fill-[#FDB022] text-[#FDB022]" />
                  ) : null}
                </div>
              </div>
            </div>
            {platform.note ? (
              <p className="mt-3 text-xs text-[#667085]">{platform.note}</p>
            ) : null}
            {!platform.verified ? (
              <Link
                href={`/businesses/${businessId}/reputation/settings`}
                className={cn(rep.btnSecondary, "mt-3 w-full justify-center text-xs")}
              >
                Open settings
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CompetitorIntelligenceDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: CompetitorIntelligenceDashboardData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const sortedRows = useMemo(
    () => [...data.leaderboardRows].sort((a, b) => b.totalReviews - a.totalReviews),
    [data.leaderboardRows]
  );
  const you = sortedRows.find((row) => row.isYou) ?? sortedRows[0];
  const youRank = you ? sortedRows.findIndex((row) => row.id === you.id) + 1 : null;
  const topCompetitor = sortedRows.find((row) => !row.isYou);
  const primaryGap = data.gapRows
    .filter((row) => row.totalGap > 0)
    .sort((a, b) => b.totalGap - a.totalGap)[0];
  const velocityGap = you && topCompetitor ? you.reviews30 - topCompetitor.reviews30 : 0;
  const requiredMonthlyPace =
    data.requiredPaceOverride ??
    (topCompetitor && primaryGap
      ? Math.max(topCompetitor.reviews30 + 1, you?.reviews30 ?? 0)
      : you?.reviews30 ?? 0);

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Competitor Intelligence"
        subtitle={`Review position, gap, and content quality compared with nearby competitors for ${data.businessName}.`}
        dateRangeLabel={data.dateRangeLabel ?? "Last 90 days"}
        primaryAction={
          <ReputationSyncButton
            businessId={businessId}
            label="Refresh Reputation Data"
          />
        }
      />

      <RepTabs tabs={tabs} active={activeTab} onChange={(tab) => setActiveTab(tab as TabId)} />

      {activeTab === "overview" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <RepMetricCard
              label="Your Rank"
              value={youRank ? `#${youRank} of ${sortedRows.length}` : "—"}
              hint={youRank && youRank <= 3 ? "Top 3 in your area" : `of ${sortedRows.length} businesses`}
              icon={Trophy}
            />
            <RepMetricCard
              label="Top Competitor 30d"
              value={`+${fmt(topCompetitor?.reviews30)}`}
              hint={topCompetitor?.name ?? "No competitor"}
              icon={Users}
            />
            <RepMetricCard
              label="Review Gap"
              value={primaryGap ? `${fmt(primaryGap.totalGap)}` : "—"}
              hint={primaryGap ? `behind ${primaryGap.competitorName}` : "No gap"}
            />
            <RepMetricCard
              label="Velocity Gap (30d)"
              value={signed(velocityGap)}
              hint="you vs top competitor"
              trendPositive={velocityGap >= 0}
              valueClassName={velocityGap < 0 ? "text-[#B42318]" : "text-[#027A48]"}
              icon={velocityGap < 0 ? ArrowDownRight : ArrowUpRight}
              iconClassName={velocityGap < 0 ? "bg-[#FEF3F2] text-[#B42318]" : undefined}
            />
            <RepMetricCard
              label="Est. Months to Catch Up"
              value={primaryGap?.estimatedCatchUpMonths == null ? "—" : fmt(primaryGap.estimatedCatchUpMonths, 1)}
              hint={primaryGap?.estimatedCatchUp ?? "At current pace"}
            />
            <RepMetricCard
              label="Required Monthly Pace"
              value={fmt(requiredMonthlyPace)}
              hint={you ? `+${fmt(requiredMonthlyPace - (you.reviews30 ?? 0))} vs current` : "reviews / month"}
            />
          </div>
          <LeaderboardTable rows={sortedRows} businessId={businessId} />
          <GapWidgets data={{ ...data, leaderboardRows: sortedRows }} />
        </>
      ) : null}

      {activeTab === "reviews" ? (
        <CompetitorReviewsWorkspace
          businessId={businessId}
          businessName={data.businessName}
          leaderboardRows={sortedRows}
          reviewsFeed={data.reviewsFeed ?? []}
        />
      ) : null}

      {activeTab === "gaps" ? (
        <div className="space-y-4">
          <GapWidgets data={{ ...data, leaderboardRows: sortedRows }} />
          <Card title="Review Gap Details">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Competitor</th>
                    <th className="px-3 py-2 font-semibold">Total Gap</th>
                    <th className="px-3 py-2 font-semibold">Velocity Gap</th>
                    <th className="px-3 py-2 font-semibold">Needed</th>
                    <th className="px-3 py-2 font-semibold">Catch-up</th>
                    <th className="px-3 py-2 font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gapRows.map((row) => (
                    <tr key={row.competitorId} className="border-b border-[#F2F4F7]">
                      <td className="px-3 py-3 font-medium text-[#101828]">{row.competitorName}</td>
                      <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.totalGap)}</td>
                      <td className={cn("px-3 py-3 tabular-nums font-semibold", row.monthlyVelocityGap < 0 ? "text-[#B42318]" : "text-[#027A48]")}>
                        {signed(row.monthlyVelocityGap, "/mo")}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.neededToCatch)}</td>
                      <td className="px-3 py-3 text-[#667085]">{row.estimatedCatchUp}</td>
                      <td className="px-3 py-3">
                        <RepBadge tone={row.gapExpanding ? "red" : "green"}>
                          {row.gapExpanding ? "Expanding" : "Closing"}
                        </RepBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "content" ? <ContentTab data={data} /> : null}

      {activeTab === "opportunities" ? (
        <div className="space-y-4">
          <StrengthsTab data={data} />
          <Card title="Positioning Opportunities" subtitle="Themes competitors lose on that you can own.">
            <div className="space-y-3">
              {(data.positioningOpportunities.length
                ? data.positioningOpportunities
                : [{ title: "No opportunities yet", description: "Refresh reputation data after competitors are tracked.", sourceTheme: "—" }]
              ).map((item) => (
                <div key={item.title} className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#101828]">{item.title}</p>
                      <p className="mt-1 text-sm leading-5 text-[#667085]">{item.description}</p>
                    </div>
                    <RepBadge tone="green">{item.sourceTheme}</RepBadge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <PlatformsTab data={data} businessId={businessId} />
        </div>
      ) : null}
    </div>
  );
}
