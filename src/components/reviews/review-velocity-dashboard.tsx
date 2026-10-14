"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Gauge,
  Info,
  ListChecks,
  MessageSquareReply,
  Minus,
  Printer,
  Share2,
  Star,
  TrendingUp,
} from "lucide-react";
import { RepCumulativeLineChart, RepHorizontalGapChart } from "@/components/reputation/rep-charts";
import { REP_GREEN, RepBadge, RepMetricCard, rep } from "@/components/reputation/rep-ui";
import { ReputationSyncButton } from "@/components/reputation/reputation-sync-button";
import type {
  ReviewAnalyticsCompetitor,
  ReviewAnalyticsData,
  ReviewAnalyticsSource,
  ReviewAnalyticsTimelinePoint,
} from "@/lib/reviews/review-analytics-data";
import { cn } from "@/lib/utils";

const BLUE = "#2563EB";
const AMBER = "#F79009";
const RED = "#D92D20";
const COMPETITOR_LINE_COLORS = ["#7DD3FC", "#A78BFA", "#C4B5FD", "#94A3B8", "#67E8F9", "#F9A8D4"];

type ReviewVelocityDashboardProps = {
  businessId: string;
  data: ReviewAnalyticsData;
};

type RangeId = "1M" | "3M" | "6M" | "1Y" | "2Y" | "YTD" | "ALL";

const rangeOptions: Array<{ id: RangeId; label: string; days?: number }> = [
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "2Y", label: "2Y", days: 730 },
  { id: "YTD", label: "YTD" },
  { id: "ALL", label: "ALL" },
];

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function signed(value: number | null | undefined, suffix = ""): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  return `${value >= 0 ? "+" : "-"}${fmt(Math.abs(value), suffix)}`;
}

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "Unknown date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getRolling(data: ReviewAnalyticsData, days: 7 | 30 | 60 | 90) {
  return data.rollingPeriods.find((period) => period.days === days);
}

function filterTimeline(points: ReviewAnalyticsTimelinePoint[], range: RangeId): ReviewAnalyticsTimelinePoint[] {
  if (!points.length || range === "ALL") return points;
  const latest = new Date(`${points[points.length - 1]!.date}T12:00:00Z`);
  if (range === "YTD") {
    const start = `${latest.getUTCFullYear()}-01-01`;
    return points.filter((point) => point.date >= start);
  }
  const days = rangeOptions.find((option) => option.id === range)?.days;
  if (!days) return points;
  const cutoff = new Date(latest);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoffKey);
}

function sentimentFromDistribution(distribution: ReviewAnalyticsData["ratingDistribution"], avgRating: number | null) {
  const positive = distribution[4] + distribution[5];
  const neutral = distribution[3];
  const negative = distribution[1] + distribution[2];
  const total = positive + neutral + negative;
  const positivePct = total > 0 ? Math.round((positive / total) * 100) : avgRating != null ? Math.round((avgRating / 5) * 100) : 0;
  const negativePct = total > 0 ? Math.round((negative / total) * 100) : 0;
  const label =
    positivePct >= 85 && (avgRating ?? 0) >= 4.5
      ? "Outstanding"
      : positivePct >= 70
        ? "Good"
        : positivePct >= 50
          ? "Mixed"
          : "Needs Attention";
  const hint =
    label === "Outstanding"
      ? "Most reviews are 4-5 star."
      : label === "Good"
        ? "Positive reviews lead the mix."
        : label === "Mixed"
          ? "Watch neutral and low-rating themes."
          : "Prioritize response and recovery.";
  return { label, hint, positive, neutral, negative, total, positivePct, negativePct };
}

function calculateTrustScore(data: ReviewAnalyticsData): number {
  const rating = data.avgRating ?? 0;
  const responseRate = data.responseRate ?? 0;
  const velocityTrend = data.priorPeriod.rolling30dDelta > 0 ? 0.1 : data.priorPeriod.rolling30dDelta < 0 ? -0.1 : 0;
  // Trust Score formula: 40% rating quality, 30% response coverage, 30% recent velocity.
  // Velocity reaches full credit at 10 reviews in the last 30 days, with a small trend lift/penalty.
  const ratingComponent = (rating / 5) * 4;
  const responseComponent = (responseRate / 100) * 3;
  const velocityComponent = Math.max(0, Math.min(1, data.rolling30d / 10 + velocityTrend)) * 3;
  return Math.round((ratingComponent + responseComponent + velocityComponent) * 10) / 10;
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(rep.card, "p-4", className)}>
      {title || subtitle || action ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold text-[#101828]">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-xs text-[#667085]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function toCumulative(values: number[]): number[] {
  let running = 0;
  return values.map((value) => {
    running += value;
    return running;
  });
}

function MiniSparkline({
  values,
  color = REP_GREEN,
  height = 34,
  cumulative = false,
}: {
  values: number[];
  color?: string;
  height?: number;
  cumulative?: boolean;
}) {
  const series = cumulative ? toCumulative(values) : values;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = Math.max(max - min, 1);
  const points = series.length
    ? series
        .map((value, index) => {
          const x = series.length === 1 ? 50 : (index / (series.length - 1)) * 100;
          const y = height - 4 - ((value - min) / span) * (height - 8);
          return `${x},${y}`;
        })
        .join(" ")
    : "";
  return (
    <svg viewBox={`0 0 100 ${height}`} className="h-8 w-24 overflow-visible" aria-hidden>
      <polyline fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" points={points} />
    </svg>
  );
}

/** Build lifetime-style cumulative totals, then filter to the selected range. */
function buildCumulativeVelocitySeries(
  points: ReviewAnalyticsTimelinePoint[],
  competitors: ReviewAnalyticsCompetitor[],
  totalReviews: number,
  range: RangeId
) {
  const competitorIds = competitors.map((competitor) => competitor.id);
  const youWindowSum = points.reduce((sum, point) => sum + point.you, 0);
  let you = Math.max(0, totalReviews - youWindowSum);
  const competitorTotals = Object.fromEntries(
    competitors.map((competitor) => {
      const windowSum = points.reduce((sum, point) => sum + (point.competitorSeries?.[competitor.id] ?? 0), 0);
      return [competitor.id, Math.max(0, competitor.totalReviews - windowSum)];
    })
  );
  let competitorAvg = 0;
  if (competitorIds.length) {
    const avgWindowSum = points.reduce((sum, point) => sum + point.competitorAvg, 0);
    const avgLifetime =
      competitors.reduce((sum, competitor) => sum + competitor.totalReviews, 0) / competitorIds.length;
    competitorAvg = Math.max(0, avgLifetime - avgWindowSum);
  }

  const cumulative = points.map((point) => {
    you += point.you;
    competitorAvg += point.competitorAvg;
    const row: Record<string, string | number> = {
      date: point.date,
      you: Math.round(you * 10) / 10,
      competitorAvg: Math.round(competitorAvg * 10) / 10,
    };
    for (const competitorId of competitorIds) {
      competitorTotals[competitorId] = (competitorTotals[competitorId] ?? 0) + (point.competitorSeries?.[competitorId] ?? 0);
      row[`c_${competitorId}`] = competitorTotals[competitorId] ?? 0;
    }
    return row;
  });

  if (!cumulative.length || range === "ALL") return cumulative;
  const latest = new Date(`${cumulative[cumulative.length - 1]!.date}T12:00:00Z`);
  if (range === "YTD") {
    const start = `${latest.getUTCFullYear()}-01-01`;
    return cumulative.filter((row) => String(row.date) >= start);
  }
  const days = rangeOptions.find((option) => option.id === range)?.days;
  if (!days) return cumulative;
  const cutoff = new Date(latest);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return cumulative.filter((row) => String(row.date) >= cutoffKey);
}

function StarRating({ rating }: { rating: number | null }) {
  const rounded = Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-4 w-4",
            index < rounded ? "fill-[#FDB022] text-[#FDB022]" : "fill-[#F2F4F7] text-[#D0D5DD]"
          )}
        />
      ))}
    </div>
  );
}

function SentimentDonut({
  positivePct,
  neutralPct,
  negativePct,
}: {
  positivePct: number;
  neutralPct: number;
  negativePct: number;
}) {
  const neutralOffset = positivePct;
  const negativeOffset = positivePct + neutralPct;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
          <circle cx="60" cy="60" r="46" fill="none" stroke="#F2F4F7" strokeWidth="16" />
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            pathLength="100"
            stroke={REP_GREEN}
            strokeWidth="16"
            strokeDasharray={`${positivePct} ${100 - positivePct}`}
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            pathLength="100"
            stroke={AMBER}
            strokeWidth="16"
            strokeDasharray={`${neutralPct} ${100 - neutralPct}`}
            strokeDashoffset={-neutralOffset}
          />
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            pathLength="100"
            stroke={RED}
            strokeWidth="16"
            strokeDasharray={`${negativePct} ${100 - negativePct}`}
            strokeDashoffset={-negativeOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[#101828]">{positivePct}%</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Positive</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <LegendDot color={REP_GREEN} label="Positive 4-5 star" value={`${positivePct}%`} />
        <LegendDot color={AMBER} label="Neutral 3 star" value={`${neutralPct}%`} />
        <LegendDot color={RED} label="Negative 1-2 star" value={`${negativePct}%`} />
      </div>
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-[#667085]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-[#101828]">{value}</span>
    </div>
  );
}

function trendMeta(delta: number) {
  if (delta > 0) return { icon: ArrowUpRight, label: "Up", className: "text-[#027A48] bg-[#ECFDF3]" };
  if (delta < 0) return { icon: ArrowDownRight, label: "Down", className: "text-[#B42318] bg-[#FEF3F2]" };
  return { icon: Minus, label: "Flat", className: "text-[#667085] bg-[#F2F4F7]" };
}

type VelocityRow = {
  id: string;
  name: string;
  kind: "source" | "competitor";
  rating: number | null;
  reviews: number;
  last30d: number;
  last60d: number;
  last90d: number;
  total: number;
  prior30d: number;
};

function sourceToRow(source: ReviewAnalyticsSource): VelocityRow {
  return {
    id: `source-${source.id}`,
    name: source.name,
    kind: "source",
    rating: source.rating,
    reviews: source.reviews,
    last30d: source.last30d,
    last60d: source.last60d,
    last90d: source.last90d,
    total: source.total,
    prior30d: source.prior30d,
  };
}

function competitorToRow(competitor: ReviewAnalyticsCompetitor): VelocityRow {
  return {
    id: `competitor-${competitor.id}`,
    name: competitor.name,
    kind: "competitor",
    rating: competitor.rating,
    reviews: competitor.totalReviews,
    last30d: competitor.rolling30d,
    last60d: competitor.rolling60d,
    last90d: competitor.rolling90d,
    total: competitor.totalReviews,
    prior30d: competitor.prior30d,
  };
}

function VelocityBreakdownTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: VelocityRow[];
  selectedId: string | null;
  onSelect: (row: VelocityRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
          <tr>
            <th className="px-3 py-2 font-semibold">Source</th>
            <th className="px-3 py-2 font-semibold">Rating</th>
            <th className="px-3 py-2 font-semibold">Reviews</th>
            <th className="px-3 py-2 font-semibold">Last 30d</th>
            <th className="px-3 py-2 font-semibold">Last 60d</th>
            <th className="px-3 py-2 font-semibold">Last 90d</th>
            <th className="px-3 py-2 font-semibold">Total</th>
            <th className="px-3 py-2 font-semibold">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const delta = row.last30d - row.prior30d;
            const meta = trendMeta(delta);
            const TrendIcon = meta.icon;
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={cn(
                  "cursor-pointer border-b border-[#F2F4F7] last:border-0 transition",
                  selected ? "bg-[#ECFDF3]" : "hover:bg-[#F9FAFB]"
                )}
                onClick={() => onSelect(row)}
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        row.kind === "source" ? "bg-[#137752]" : "bg-[#2563EB]"
                      )}
                    />
                    <div>
                      <p className="font-semibold text-[#101828]">{row.name}</p>
                      <p className="text-xs text-[#98A2B3]">{row.kind === "source" ? "Your business" : "Competitor"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={row.rating} />
                    <span className="text-xs tabular-nums text-[#667085]">
                      {row.rating != null ? fmt(row.rating) : "-"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.reviews)}</td>
                <td className="px-3 py-3 tabular-nums font-semibold text-[#101828]">{fmt(row.last30d)}</td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.last60d)}</td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.last90d)}</td>
                <td className="px-3 py-3 tabular-nums text-[#344054]">{fmt(row.total)}</td>
                <td className="px-3 py-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", meta.className)}>
                    <TrendIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReviewCalendar({ points }: { points: ReviewAnalyticsTimelinePoint[] }) {
  const activeDates = new Set(points.filter((point) => point.you > 0).map((point) => point.date));
  const latest = points.length ? new Date(`${points[points.length - 1]!.date}T12:00:00Z`) : new Date();
  const year = latest.getUTCFullYear();
  const month = latest.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const blanks = Array.from({ length: firstDay }, (_, index) => index);
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-[#101828]">
          {latest.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
        <CalendarDays className="h-4 w-4 text-[#137752]" />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#98A2B3]">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {blanks.map((blank) => (
          <span key={`blank-${blank}`} className="h-9" />
        ))}
        {days.map((day) => {
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const active = activeDates.has(key);
          return (
            <div
              key={key}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-lg text-xs font-medium",
                active ? "bg-[#ECFDF3] text-[#027A48]" : "text-[#667085]"
              )}
            >
              {day}
              {active ? <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#137752]" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewVelocityDashboard({ businessId, data }: ReviewVelocityDashboardProps) {
  const [range, setRange] = useState<RangeId>("6M");
  const [shareCopied, setShareCopied] = useState(false);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const recentRef = useRef<HTMLDivElement | null>(null);
  const basePath = `/businesses/${businessId}/reputation`;

  const sentiment = useMemo(
    () => sentimentFromDistribution(data.ratingDistribution, data.avgRating),
    [data.avgRating, data.ratingDistribution]
  );
  const trustScore = useMemo(() => calculateTrustScore(data), [data]);
  const scorePct = Math.round(trustScore * 10);
  const filteredTimeline = useMemo(() => filterTimeline(data.timelinePoints, range), [data.timelinePoints, range]);
  const chartData = useMemo(
    () => buildCumulativeVelocitySeries(data.timelinePoints, data.competitors, data.totalReviews, range),
    [data.competitors, data.timelinePoints, data.totalReviews, range]
  );
  const chartSeries = useMemo(() => {
    const series: Array<{ dataKey: string; name: string; color: string; strokeWidth?: number; dashed?: boolean }> = [
      { dataKey: "you", name: data.businessName || "You", color: BLUE, strokeWidth: 3 },
    ];
    data.competitors.slice(0, 4).forEach((competitor, index) => {
      series.push({
        dataKey: `c_${competitor.id}`,
        name: competitor.name,
        color: COMPETITOR_LINE_COLORS[index % COMPETITOR_LINE_COLORS.length]!,
        strokeWidth: 2,
        dashed: true,
      });
    });
    if (!data.competitors.length && chartData.some((row) => Number(row.competitorAvg) > 0)) {
      series.push({
        dataKey: "competitorAvg",
        name: "Competitor avg",
        color: "#94A3B8",
        strokeWidth: 2,
        dashed: true,
      });
    }
    return series;
  }, [chartData, data.businessName, data.competitors]);
  const events = filteredTimeline.filter((point) => point.events.length > 0);
  const velocityRows = useMemo(() => {
    const sourceRows = data.sources.length
      ? data.sources.map(sourceToRow)
      : data.totalReviews > 0
        ? [
            sourceToRow({
              id: "google",
              name: "Google",
              provider: "google",
              rating: data.avgRating,
              reviews: data.totalReviews,
              last30d: data.rolling30d,
              last60d: data.rolling60d,
              last90d: data.rolling90d,
              total: data.totalReviews,
              prior30d: data.priorPeriod.rolling30d,
            }),
          ]
        : [];
    return [...sourceRows, ...data.competitors.map(competitorToRow)];
  }, [data]);

  const focusCompetitorId = useMemo(() => {
    if (!focusRowId?.startsWith("competitor-")) return null;
    return focusRowId.replace(/^competitor-/, "");
  }, [focusRowId]);

  const highlightedSeriesKey = useMemo(() => {
    if (!focusRowId) return null;
    if (focusRowId.startsWith("competitor-")) return `c_${focusRowId.replace(/^competitor-/, "")}`;
    return "you";
  }, [focusRowId]);

  const yourWeeklyPace = Math.round((data.rolling30d / (30 / 7)) * 100) / 100;
  const marketWeeklyPace =
    data.competitors.length > 0
      ? Math.round(
          (data.competitors.reduce((sum, competitor) => sum + competitor.rolling30d, 0) /
            data.competitors.length /
            (30 / 7)) *
            100
        ) / 100
      : 0;
  const paceLeader = [...data.competitors].sort((a, b) => b.rolling30d - a.rolling30d)[0] ?? null;
  const leaderWeeklyPace = paceLeader
    ? Math.round((paceLeader.rolling30d / (30 / 7)) * 100) / 100
    : yourWeeklyPace;
  const paceGap = Math.max(0, Math.round((leaderWeeklyPace - yourWeeklyPace) * 100) / 100);

  const velocityTarget = useMemo(() => {
    const ahead = [...data.competitors]
      .filter((competitor) => competitor.totalReviews > data.totalReviews)
      .sort((a, b) => b.totalReviews - a.totalReviews)[0];
    if (!ahead) return null;
    const totalGap = ahead.totalReviews - data.totalReviews;
    const theirWeekly = Math.round((ahead.rolling30d / (30 / 7)) * 100) / 100;
    // Need to beat their weekly pace enough to close the gap in a reasonable window.
    const neededWeekly = Math.max(theirWeekly + 0.5, yourWeeklyPace + 0.5, 1);
    const weeklyGain = neededWeekly - theirWeekly;
    const months =
      weeklyGain > 0 ? Math.round(((totalGap / weeklyGain) / (52 / 12)) * 10) / 10 : null;
    return {
      name: ahead.name,
      current: yourWeeklyPace,
      needed: Math.round(neededWeekly * 100) / 100,
      difference: Math.round((neededWeekly - yourWeeklyPace) * 100) / 100,
      months,
    };
  }, [data.competitors, data.totalReviews, yourWeeklyPace]);

  const filteredRecentReviews = useMemo(() => {
    let reviews = data.recentReviews;
    if (focusCompetitorId) {
      reviews = reviews.filter((review) => review.competitorId === focusCompetitorId);
    } else if (focusRowId && !focusRowId.startsWith("competitor-")) {
      reviews = reviews.filter((review) => review.isYou);
    }
    if (focusDate) {
      reviews = reviews.filter((review) => (review.date ?? "").slice(0, 10) === focusDate);
    }
    return reviews.slice(0, 6);
  }, [data.recentReviews, focusCompetitorId, focusDate, focusRowId]);

  const sourceBars = velocityRows.map((row) => ({
    name: row.kind === "source" ? row.name : row.name,
    value: row.total,
    isYou: row.kind === "source",
  }));
  const ratingSpark = data.recentReviews
    .filter((review) => review.isYou)
    .slice()
    .reverse()
    .map((review) => review.rating ?? 0);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1600);
    } catch {
      setShareCopied(false);
    }
  };

  const handleSelectRow = (row: VelocityRow) => {
    setFocusRowId((current) => (current === row.id ? null : row.id));
    setFocusDate(null);
    window.setTimeout(() => recentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  return (
    <div className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={cn(rep.title, "inline-flex items-center gap-2")}>
            Review Velocity
            <Info className="h-4 w-4 text-[#98A2B3]" aria-hidden />
          </h1>
          <p className={rep.subtitle}>Track review volume, response coverage, and velocity over time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={rep.btnSecondary} onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button type="button" className={rep.btnSecondary} onClick={() => void handleShare()}>
            {shareCopied ? <CheckCircle2 className="h-4 w-4 text-[#027A48]" /> : <Share2 className="h-4 w-4" />}
            {shareCopied ? "Copied" : "Share"}
          </button>
          <button type="button" className={rep.btnSecondary} onClick={() => chartRef.current?.scrollIntoView({ behavior: "smooth" })}>
            <TrendingUp className="h-4 w-4" />
            View Trends
          </button>
          <ReputationSyncButton businessId={businessId} label="Refresh" className="print:hidden" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <RepMetricCard
          label="Reviews to Date"
          value={fmt(data.totalReviews)}
          trend={signed(data.priorPeriod.rolling30dDelta)}
          trendPositive={data.priorPeriod.rolling30dDelta >= 0}
          hint={`${fmt(data.rolling30d)} new since last month`}
          icon={Clipboard}
        />
        <RepMetricCard
          label="Average Rating"
          value={data.avgRating != null ? fmt(data.avgRating) : "-"}
          trend={signed(data.avgRatingDelta)}
          trendPositive={(data.avgRatingDelta ?? 0) >= 0}
          hint="vs prior rating window"
          icon={Star}
        />
        <RepMetricCard
          label="Ref. Sentiment"
          value={sentiment.label}
          hint={sentiment.hint}
          trend={`${sentiment.positivePct}% positive`}
          trendPositive={sentiment.positivePct >= 70}
          icon={Gauge}
          valueClassName="text-[22px]"
        />
        <RepMetricCard
          label="Response Rate"
          value={pct(data.responseRate)}
          trend={signed(data.responseRateDelta, " pts")}
          trendPositive={(data.responseRateDelta ?? 0) >= 0}
          hint="last 30d where available"
          icon={MessageSquareReply}
        />
        <RepMetricCard
          label="Review Pace"
          value={`${fmt(yourWeeklyPace)}/wk`}
          hint={
            paceLeader
              ? `Market ${fmt(marketWeeklyPace)} · Leader ${fmt(leaderWeeklyPace)}`
              : "reviews per week (30d)"
          }
          trend={paceGap > 0 ? `Need +${fmt(paceGap)}/wk` : "At or above leader"}
          trendPositive={paceGap <= 0}
          icon={Gauge}
        />
        <RepMetricCard
          label="Trust Score"
          value={`${fmt(trustScore)}/10`}
          hint="Rating + response + velocity"
          trend={`${scorePct}%`}
          trendPositive={trustScore >= 7}
          icon={CheckCircle2}
        />
      </div>

      {velocityTarget ? (
        <SectionCard
          title={`Velocity Target · Pass ${velocityTarget.name}`}
          subtitle="Actionable catch-up pace based on current weekly review velocity."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
              <p className={rep.label}>Current</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#101828]">{fmt(velocityTarget.current)}/wk</p>
            </div>
            <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
              <p className={rep.label}>Needed</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#101828]">{fmt(velocityTarget.needed)}/wk</p>
            </div>
            <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
              <p className={rep.label}>Difference</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#B42318]">+{fmt(velocityTarget.difference)}/wk</p>
            </div>
            <div className="rounded-xl border border-[#B7E4D0] bg-[#ECFDF3] p-4">
              <p className={rep.label}>Estimated Catch-up</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#027A48]">
                {velocityTarget.months == null
                  ? "Not at this pace"
                  : velocityTarget.months <= 0
                    ? "Caught up"
                    : `${fmt(velocityTarget.months)} mo`}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Review Velocity Over Time"
        subtitle="Cumulative review totals for you and tracked competitors. Use the range chips or brush to zoom."
        action={
          <div className="flex flex-wrap rounded-lg bg-[#F2F4F7] p-1">
            {rangeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  range === option.id ? "bg-white text-[#137752] shadow-sm" : "text-[#667085] hover:text-[#101828]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      >
        <div ref={chartRef}>
          {chartData.length ? (
            <>
              <RepCumulativeLineChart
                data={chartData}
                height={420}
                highlightedKey={highlightedSeriesKey}
                onPointClick={({ date }) => {
                  setFocusDate(date);
                  window.setTimeout(
                    () => recentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                    50
                  );
                }}
                markers={events.map((point) => ({
                  x: point.date,
                  label: point.events[0]?.label ?? "",
                  color: point.events.some((event) => event.type === "campaign_start") ? AMBER : BLUE,
                }))}
                series={chartSeries}
              />
              {focusDate || focusRowId ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                  <span>
                    Focus:{" "}
                    {focusRowId
                      ? velocityRows.find((row) => row.id === focusRowId)?.name ?? "Selected business"
                      : "All businesses"}
                    {focusDate ? ` · ${dateLabel(focusDate)}` : ""}
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-[#137752] hover:underline"
                    onClick={() => {
                      setFocusRowId(null);
                      setFocusDate(null);
                    }}
                  >
                    Clear focus
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#98A2B3]">
                  Click a table row to highlight a line, or click the chart to filter reviews for that day.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-[#667085]">No review timeline yet. Refresh reputation data to populate velocity trends.</p>
              <ReputationSyncButton businessId={businessId} label="Refresh" />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Velocity Breakdown" subtitle="Click a row to highlight their line and filter recent reviews.">
        <VelocityBreakdownTable rows={velocityRows} selectedId={focusRowId} onSelect={handleSelectRow} />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SectionCard title="Review Analysis" subtitle="Rolling review counts compared with the previous matching window.">
          <div className="grid gap-3 sm:grid-cols-2">
            {([7, 30, 60, 90] as const).map((days) => {
              const period = getRolling(data, days);
              const spark = data.timelinePoints.slice(-days).map((point) => point.you);
              return (
                <div key={days} className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={rep.label}>Last {days} days</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-[#101828]">{fmt(period?.current ?? 0)}</p>
                      <p className="mt-1 text-xs text-[#667085]">
                        <span className={cn("font-semibold", (period?.delta ?? 0) >= 0 ? "text-[#027A48]" : "text-[#B42318]")}>
                          {signed(period?.delta) ?? "+0"}
                        </span>{" "}
                        vs previous {days}d
                      </p>
                    </div>
                    <MiniSparkline values={spark} cumulative />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Sentiment Analysis" subtitle="Positive share from stored star ratings.">
          <SentimentDonut
            positivePct={sentiment.positivePct}
            neutralPct={sentiment.total > 0 ? Math.round((sentiment.neutral / sentiment.total) * 100) : 0}
            negativePct={sentiment.negativePct}
          />
          <div className="mt-5 space-y-2 text-sm text-[#344054]">
            <p className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
              {sentiment.positive} positive review{sentiment.positive === 1 ? "" : "s"} in the stored rating mix.
            </p>
            <p className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#F79009]" />
              {sentiment.neutral + sentiment.negative} review{sentiment.neutral + sentiment.negative === 1 ? "" : "s"} need monitoring or response follow-up.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Total Reviews by Source" subtitle="Google and competitor totals from synced review data.">
          <RepHorizontalGapChart rows={sourceBars.length ? sourceBars : [{ name: "Google", value: 0, isYou: true }]} height={220} />
        </SectionCard>
        <SectionCard title="Response Rate" subtitle="Owner response coverage for the latest review window.">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-bold tracking-tight text-[#101828]">{pct(data.responseRate)}</p>
              <p className="mt-2 text-sm text-[#667085]">
                {data.avgResponseTimeDays != null ? `${fmt(data.avgResponseTimeDays)} days avg response time` : "Response time unavailable"}
              </p>
            </div>
            <MiniSparkline values={data.timelinePoints.slice(-30).map((point) => point.you)} color={BLUE} />
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div className="h-full rounded-full bg-[#137752]" style={{ width: `${Math.max(0, Math.min(100, data.responseRate))}%` }} />
          </div>
        </SectionCard>
        <SectionCard title="Rating" subtitle="Average star rating and latest rating pattern.">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-5xl font-bold tracking-tight text-[#101828]">{data.avgRating != null ? fmt(data.avgRating) : "-"}</p>
              <div className="mt-2">
                <StarRating rating={data.avgRating} />
              </div>
            </div>
            <MiniSparkline values={ratingSpark.length ? ratingSpark : [data.avgRating ?? 0]} color={AMBER} />
          </div>
          <p className="mt-5 text-sm text-[#667085]">
            {data.avgRatingDelta != null ? `${signed(data.avgRatingDelta)} vs prior rating window.` : "Rating delta appears after another comparable window."}
          </p>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Review Calendar" subtitle="Dots mark days with new reviews.">
          <ReviewCalendar points={data.timelinePoints} />
        </SectionCard>

        <SectionCard title="Tasks Pending" subtitle="Recommended actions to improve review velocity.">
          <div className="space-y-3">
            {(data.tasks.length
              ? data.tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  description: task.description ?? "Recommended by the latest review momentum run.",
                  href: `${basePath}/reviews`,
                  badge: task.priority ?? "Task",
                }))
              : [
                  {
                    id: "request",
                    title: "Send review requests",
                    description: "Ask recent happy customers for reviews.",
                    href: `${basePath}/requests`,
                    badge: "Growth",
                  },
                  {
                    id: "reply",
                    title: "Reply to unanswered reviews",
                    description: "Improve trust signals and response coverage.",
                    href: `${basePath}/reviews`,
                    badge: "Response",
                  },
                  {
                    id: "campaign",
                    title: "Launch a review campaign",
                    description: "Create a steady request cadence.",
                    href: `${basePath}/campaigns`,
                    badge: "Velocity",
                  },
                ]
            ).slice(0, 3).map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className="block rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-3 transition hover:border-[#B7E4D0] hover:bg-[#F6FEF9]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#101828]">{task.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">{task.description}</p>
                  </div>
                  <RepBadge tone="green">{task.badge}</RepBadge>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <div ref={recentRef}>
        <SectionCard
          title="Recent Reviews"
          subtitle={
            focusCompetitorId || (focusRowId && !focusCompetitorId) || focusDate
              ? "Filtered by your current chart/table focus."
              : "Latest reviews from the synced review store."
          }
          action={
            <Link href={`${basePath}/reviews`} className={rep.link}>
              View all reviews
            </Link>
          }
        >
          {filteredRecentReviews.length ? (
            <div className="space-y-3">
              {filteredRecentReviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#101828]">{review.reviewerName}</p>
                      <p className="text-xs text-[#98A2B3]">
                        {review.businessName}
                        {review.date ? ` · ${dateLabel(review.date)}` : ""}
                      </p>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-5 text-[#344054]">
                    {review.text || "No review text provided."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#D0D5DD] p-6 text-center">
              <ListChecks className="mx-auto h-6 w-6 text-[#137752]" />
              <p className="mt-2 text-sm text-[#667085]">
                {focusRowId || focusDate
                  ? "No reviews match the current focus. Clear focus to see the full feed."
                  : "Latest reviews appear here after a reputation sync."}
              </p>
              <Link href={`${basePath}/reviews`} className={cn(rep.link, "mt-3 justify-center")}>
                View all reviews
              </Link>
            </div>
          )}
        </SectionCard>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[#B7E4D0] bg-[#ECFDF3] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold text-[#101828]">{scorePct}% Score performance</p>
          <p className="text-sm text-[#667085]">Based on trust score, response coverage, and recent review velocity.</p>
        </div>
        <Link href={`${basePath}/settings`} className={rep.btnPrimary}>
          Get Weekly Update
        </Link>
      </div>
    </div>
  );
}
