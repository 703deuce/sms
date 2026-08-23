import { startOfDay, subDays } from "date-fns";
import type { NormalizedReview } from "@/lib/reviews/normalize";
import type { EntityMomentumMetrics } from "@/lib/reviews/metrics";

export type VelocityTrendDirection = "accelerating" | "stable" | "losing";
export type MarketActivityLevel = "very_competitive" | "moderate" | "low";
export type RecencyStatus = "fresh" | "warning" | "stale";

export interface EntityShare30d {
  name: string;
  entityType: "target" | "competitor";
  reviews30d: number;
  sharePct: number;
}

export interface WeeklyPaceRow {
  name: string;
  entityType: "target" | "competitor";
  avgReviewsPerWeek: number;
}

export interface MarketInsights {
  shareOfNewReviews30d: EntityShare30d[];
  targetSharePct30d: number;
  weeklyPace: WeeklyPaceRow[];
  top3AvgWeeklyPace: number;
  currentWeeklyPace: number;
  recommendedWeeklyPace: number;
  weeklyPaceGap: number;
  velocityTrend: VelocityTrendDirection;
  velocityTrendLabel: string;
  reviewStreakWeeks: number;
  daysWithoutReview: number | null;
  recencyStatus: RecencyStatus;
  marketActivityLevel: MarketActivityLevel;
  marketActivityLabel: string;
  marketReviews30d: number;
  entityCount: number;
}

export function recencyStatus(daysSinceLast: number | null): RecencyStatus {
  if (daysSinceLast == null) return "stale";
  if (daysSinceLast <= 7) return "fresh";
  if (daysSinceLast <= 14) return "warning";
  return "stale";
}

export function recencyStatusClass(status: RecencyStatus): string {
  switch (status) {
    case "fresh":
      return "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300";
    case "warning":
      return "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300";
    default:
      return "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300";
  }
}

export function velocityTrendFromBuckets(
  trendBuckets90d: Array<{ count: number }>,
  accelerationPct: number | null
): VelocityTrendDirection {
  if (accelerationPct != null) {
    if (accelerationPct >= 25) return "accelerating";
    if (accelerationPct <= -25) return "losing";
  }
  const recent = (trendBuckets90d[0]?.count ?? 0) + (trendBuckets90d[1]?.count ?? 0);
  const prior = (trendBuckets90d[2]?.count ?? 0) + (trendBuckets90d[3]?.count ?? 0);
  if (prior === 0) return recent > 0 ? "accelerating" : "stable";
  const ratio = recent / prior;
  if (ratio >= 1.25) return "accelerating";
  if (ratio <= 0.75) return "losing";
  return "stable";
}

export function velocityTrendLabel(trend: VelocityTrendDirection): string {
  switch (trend) {
    case "accelerating":
      return "▲ Accelerating";
    case "losing":
      return "▼ Losing Momentum";
    default:
      return "→ Steady";
  }
}

export function marketActivityFromTotal(reviews30d: number, entityCount: number): {
  level: MarketActivityLevel;
  label: string;
} {
  const avg = entityCount > 0 ? reviews30d / entityCount : 0;
  if (reviews30d >= 80 || avg >= 8) {
    return { level: "very_competitive", label: "Very Competitive" };
  }
  if (reviews30d >= 25 || avg >= 3) {
    return { level: "moderate", label: "Moderate Activity" };
  }
  return { level: "low", label: "Low Activity" };
}

export function calcReviewStreakWeeks(reviews: NormalizedReview[], now = new Date()): number {
  const dated = reviews.filter((r) => r.reviewDate);
  if (!dated.length) return 0;

  let streak = 0;
  for (let w = 0; w < 52; w++) {
    const weekEnd = startOfDay(subDays(now, w * 7));
    const weekStart = subDays(weekEnd, 6);
    const hasReview = dated.some((r) => {
      const d = startOfDay(r.reviewDate!);
      return d >= weekStart && d <= weekEnd;
    });
    if (hasReview) {
      streak++;
    } else if (w === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function buildMarketInsights(
  target: EntityMomentumMetrics,
  competitors: Array<{ name: string; metrics: EntityMomentumMetrics }>,
  reviews: NormalizedReview[] = [],
  now = new Date()
): MarketInsights {
  const active = [
    { name: "You", entityType: "target" as const, metrics: target },
    ...competitors
      .filter((c) => c.metrics.velocityAvailable)
      .map((c) => ({ name: c.name, entityType: "competitor" as const, metrics: c.metrics })),
  ];

  const marketReviews30d = active.reduce((sum, e) => sum + e.metrics.reviews30d, 0);
  const shareOfNewReviews30d: EntityShare30d[] = active.map((e) => ({
    name: e.name,
    entityType: e.entityType,
    reviews30d: e.metrics.reviews30d,
    sharePct:
      marketReviews30d > 0
        ? Math.round((e.metrics.reviews30d / marketReviews30d) * 1000) / 10
        : 0,
  }));

  const weeklyPace: WeeklyPaceRow[] = active.map((e) => ({
    name: e.name,
    entityType: e.entityType,
    avgReviewsPerWeek: e.metrics.avgReviewsPerWeek,
  }));

  const compPace = competitors
    .filter((c) => c.metrics.velocityAvailable)
    .map((c) => c.metrics.avgReviewsPerWeek)
    .sort((a, b) => b - a);
  const top3 = compPace.slice(0, 3);
  const top3AvgWeeklyPace =
    top3.length > 0
      ? Math.round((top3.reduce((a, b) => a + b, 0) / top3.length) * 100) / 100
      : 0;

  const currentWeeklyPace = target.avgReviewsPerWeek;
  const recommendedWeeklyPace = target.recommendedWeeklyTarget ?? Math.ceil(top3AvgWeeklyPace || 1);
  const weeklyPaceGap =
    Math.round(Math.max(0, recommendedWeeklyPace - currentWeeklyPace) * 100) / 100;

  const velocityTrend = velocityTrendFromBuckets(target.trendBuckets90d, target.accelerationPct);
  const { level, label } = marketActivityFromTotal(marketReviews30d, active.length);
  const daysWithoutReview = target.daysSinceLastReview;
  const reviewStreakWeeks = calcReviewStreakWeeks(reviews, now);

  return {
    shareOfNewReviews30d,
    targetSharePct30d:
      shareOfNewReviews30d.find((s) => s.entityType === "target")?.sharePct ?? 0,
    weeklyPace,
    top3AvgWeeklyPace,
    currentWeeklyPace,
    recommendedWeeklyPace,
    weeklyPaceGap,
    velocityTrend,
    velocityTrendLabel: velocityTrendLabel(velocityTrend),
    reviewStreakWeeks,
    daysWithoutReview,
    recencyStatus: recencyStatus(daysWithoutReview),
    marketActivityLevel: level,
    marketActivityLabel: label,
    marketReviews30d,
    entityCount: active.length,
  };
}

/** Reconstruct market insights from saved entity rows (older runs without marketInsights). */
export function buildMarketInsightsFromEntityRows(
  entities: Array<{
    entity_type: string;
    name: string;
    reviews_30d: number;
    avg_reviews_per_week: number;
    days_since_last_review: number | null;
    recommended_weekly_target?: number | null;
    metrics_json?: {
      trendBuckets90d?: Array<{ count: number }>;
      velocityAvailable?: boolean;
      unavailable?: boolean;
    };
  }>
): MarketInsights | null {
  const target = entities.find((e) => e.entity_type === "target");
  if (!target) return null;
  const velocityAvailable =
    target.metrics_json?.velocityAvailable ?? target.metrics_json?.unavailable !== true;
  if (!velocityAvailable) return null;

  const targetMetrics: EntityMomentumMetrics = {
    totalReviewsCurrent: 0,
    ratingCurrent: null,
    reviews7d: 0,
    reviews30d: target.reviews_30d,
    reviews90d: 0,
    reviewsYesterday: 0,
    avgReviewsPerWeek: Number(target.avg_reviews_per_week),
    daysSinceLastReview: target.days_since_last_review,
    accelerationPct: null,
    consistencyScore: 0,
    velocityScore: 0,
    recencyScore: 0,
    momentumScore: 0,
    momentumLabel: "Stable",
    gapToTop3_30d: null,
    recommendedWeeklyTarget: target.recommended_weekly_target ?? null,
    dailyExact7d: [],
    weeklyBuckets8to30: [],
    trendBuckets90d: (target.metrics_json?.trendBuckets90d ?? []).map((b) => ({
      label: "label" in b ? String((b as { label: string }).label) : "",
      count: b.count,
      bucketed: "bucketed" in b ? Boolean((b as { bucketed: boolean }).bucketed) : true,
    })),
    dailyCounts30d: [],
    weeklyCounts8w: [],
    weekdayHeatmap: [],
    unparsedDateCount: 0,
    velocityAvailable: true,
    velocityWarning: null,
  };

  const competitors = entities
    .filter((e) => e.entity_type === "competitor")
    .filter((e) => e.metrics_json?.velocityAvailable ?? e.metrics_json?.unavailable !== true)
    .map((e) => ({
      name: e.name,
      metrics: {
        ...targetMetrics,
        reviews30d: e.reviews_30d,
        avgReviewsPerWeek: Number(e.avg_reviews_per_week),
        daysSinceLastReview: e.days_since_last_review,
        velocityAvailable: true,
      } as EntityMomentumMetrics,
    }));

  return buildMarketInsights(targetMetrics, competitors);
}
