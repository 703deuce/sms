import { subDays, startOfDay, format, getDay } from "date-fns";
import { daysSince, type NormalizedReview } from "@/lib/reviews/normalize";
import { aggregateBucketedCounts, classifyReviewAge } from "@/lib/reviews/date-buckets";

export type MomentumLabel =
  | "Exploding"
  | "Accelerating"
  | "Healthy"
  | "Stable"
  | "Slowing"
  | "Dormant";

export interface EntityMomentumMetrics {
  totalReviewsCurrent: number;
  ratingCurrent: number | null;
  reviews7d: number;
  reviews30d: number;
  reviews90d: number;
  reviewsYesterday: number;
  avgReviewsPerWeek: number;
  daysSinceLastReview: number | null;
  accelerationPct: number | null;
  consistencyScore: number;
  velocityScore: number;
  recencyScore: number;
  momentumScore: number;
  momentumLabel: MomentumLabel;
  gapToTop3_30d: number | null;
  recommendedWeeklyTarget: number | null;
  /** Exact daily counts for last 7 days only */
  dailyExact7d: Array<{ date: string; count: number; exact: boolean }>;
  /** Weekly buckets for days 8–30 (not exact calendar placement) */
  weeklyBuckets8to30: Array<{ label: string; count: number; bucketed: boolean }>;
  /** 90-day trend: 0–7 exact, 8–30 weekly, 31–60, 61–90 */
  trendBuckets90d: Array<{ label: string; count: number; bucketed: boolean }>;
  /** @deprecated use dailyExact7d + weeklyBuckets8to30 */
  dailyCounts30d: Array<{ date: string; count: number }>;
  weeklyCounts8w: Array<{ week: string; count: number }>;
  weekdayHeatmap: Array<{ day: string; count: number }>;
  unparsedDateCount: number;
  velocityAvailable: boolean;
  velocityWarning: string | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function reviewsInRange(reviews: NormalizedReview[], start: Date, end: Date): NormalizedReview[] {
  return reviews.filter((r) => {
    if (!r.reviewDate) return false;
    const d = startOfDay(r.reviewDate);
    return d >= startOfDay(start) && d <= startOfDay(end);
  });
}

function calcAcceleration(reviews30dCurrent: number, reviews: NormalizedReview[], now = new Date()): number | null {
  const prevStart = subDays(startOfDay(now), 60);
  const prevEnd = subDays(startOfDay(now), 31);
  const previous30 = reviewsInRange(
    reviews.filter((r) => r.reviewDate),
    prevStart,
    prevEnd
  ).length;
  if (previous30 === 0) return reviews30dCurrent > 0 ? 100 : 0;
  return Math.round(((reviews30dCurrent - previous30) / previous30) * 1000) / 10;
}

function calcConsistency90(trendBuckets90d: Array<{ count: number }>): number {
  const active = trendBuckets90d.filter((b) => b.count > 0).length;
  return Math.round((active / trendBuckets90d.length) * 1000) / 10;
}

function calcRecency7d(reviews7d: number, daysSinceLast: number | null): number {
  if (reviews7d >= 3) return 100;
  if (reviews7d >= 2) return 85;
  if (reviews7d >= 1) return 70;
  if (daysSinceLast == null) return 0;
  if (daysSinceLast <= 7) return 50;
  if (daysSinceLast <= 14) return 25;
  return 0;
}

export function momentumLabelFromScore(score: number): MomentumLabel {
  if (score >= 85) return "Exploding";
  if (score >= 70) return "Accelerating";
  if (score >= 50) return "Healthy";
  if (score >= 30) return "Stable";
  if (score >= 10) return "Slowing";
  return "Dormant";
}

function buildBaseMomentumScore(params: {
  velocityScore: number;
  recencyScore: number;
  consistency90: number;
  accelerationPct: number | null;
}): number {
  const accelNorm =
    params.accelerationPct == null ? 50 : Math.min(100, Math.max(0, 50 + params.accelerationPct / 2));
  return (
    Math.round(
      Math.min(
        100,
        Math.max(
          0,
          params.velocityScore * 0.5 +
            params.recencyScore * 0.25 +
            params.consistency90 * 0.15 +
            accelNorm * 0.1
        )
      ) * 10
    ) / 10
  );
}

export function calcEntityMetrics(
  reviews: NormalizedReview[],
  params: {
    totalReviewsCurrent?: number;
    ratingCurrent?: number | null;
    now?: Date;
    velocityAvailable?: boolean;
    velocityWarning?: string | null;
  } = {}
): EntityMomentumMetrics {
  const now = params.now ?? new Date();
  const classified = reviews.filter((r) => classifyReviewAge(r, now) != null);
  const unparsedDateCount = reviews.length - classified.length;
  const velocityAvailable = params.velocityAvailable ?? classified.length > 0;

  const buckets = aggregateBucketedCounts(reviews, now);

  const dated = reviews.filter((r) => r.reviewDate);
  const sorted = [...dated].sort((a, b) => b.reviewDate!.getTime() - a.reviewDate!.getTime());
  const lastReview = sorted[0]?.reviewDate ?? null;
  const daysSinceLast = daysSince(lastReview, now);

  const yesterday = subDays(startOfDay(now), 1);
  const reviewsYesterday = reviewsInRange(dated, yesterday, yesterday).length;

  const reviews7d = buckets.reviews7d;
  const reviews30d = buckets.reviews30d;
  const reviews90d = buckets.reviews90d;

  const avgReviewsPerWeek = Math.round((reviews30d / 4.3) * 100) / 100;

  const accelerationPct = calcAcceleration(reviews30d, reviews, now);
  const consistencyScore = calcConsistency90(buckets.trendBuckets90d);
  const recencyScore = calcRecency7d(reviews7d, daysSinceLast);

  const momentumScore = buildBaseMomentumScore({
    velocityScore: Math.min(100, reviews30d * 10),
    recencyScore,
    consistency90: consistencyScore,
    accelerationPct,
  });

  const weekdayHeatmap = DAY_NAMES.map((day, idx) => ({
    day,
    count: classified.filter((r) => {
      const b = classifyReviewAge(r, now);
      return b?.in7dExact && r.reviewDate && getDay(r.reviewDate) === idx;
    }).length,
  }));

  const weeklyCounts8w = buckets.weeklyBuckets8to30.map((w) => ({
    week: w.label,
    count: w.count,
  }));

  const dailyCounts30d = [
    ...buckets.dailyExact7d.map((d) => ({ date: d.date, count: d.count })),
    ...buckets.weeklyBuckets8to30.map((w) => ({ date: w.label, count: w.count })),
  ];

  return {
    totalReviewsCurrent: params.totalReviewsCurrent ?? reviews.length,
    ratingCurrent: params.ratingCurrent ?? null,
    reviews7d,
    reviews30d,
    reviews90d,
    reviewsYesterday,
    avgReviewsPerWeek,
    daysSinceLastReview: daysSinceLast,
    accelerationPct,
    consistencyScore,
    velocityScore: 0,
    recencyScore,
    momentumScore,
    momentumLabel: momentumLabelFromScore(momentumScore),
    gapToTop3_30d: null,
    recommendedWeeklyTarget: null,
    dailyExact7d: buckets.dailyExact7d,
    weeklyBuckets8to30: buckets.weeklyBuckets8to30,
    trendBuckets90d: buckets.trendBuckets90d,
    dailyCounts30d,
    weeklyCounts8w,
    weekdayHeatmap,
    unparsedDateCount,
    velocityAvailable,
    velocityWarning: params.velocityWarning ?? null,
  };
}

export function applyGapAndTargets(
  target: EntityMomentumMetrics,
  competitors: EntityMomentumMetrics[]
): { target: EntityMomentumMetrics; competitors: EntityMomentumMetrics[] } {
  const compSorted = [...competitors].sort((a, b) => b.reviews30d - a.reviews30d);
  const top3 = compSorted.slice(0, 3);
  const top3Avg30 = top3.length ? top3.reduce((a, c) => a + c.reviews30d, 0) / top3.length : 0;
  const top3AvgWeekly = top3.length
    ? top3.reduce((a, c) => a + c.avgReviewsPerWeek, 0) / top3.length
    : 0;

  const gap = Math.max(0, Math.round(top3Avg30 - target.reviews30d));
  const recommended =
    top3AvgWeekly > 0
      ? Math.ceil(Math.max(top3AvgWeekly, target.avgReviewsPerWeek + 0.01))
      : Math.max(1, Math.ceil(target.avgReviewsPerWeek + 1));
  const topReviews30d = Math.max(...competitors.map((c) => c.reviews30d), 1);

  const scoreEntity = (m: EntityMomentumMetrics): EntityMomentumMetrics => {
    const velocityScore =
      topReviews30d > 0 ? Math.min(100, Math.round((m.reviews30d / topReviews30d) * 1000) / 10) : 0;
    const momentumScore = buildBaseMomentumScore({
      velocityScore,
      recencyScore: m.recencyScore,
      consistency90: m.consistencyScore,
      accelerationPct: m.accelerationPct,
    });
    return {
      ...m,
      velocityScore,
      momentumScore,
      momentumLabel: momentumLabelFromScore(momentumScore),
    };
  };

  return {
    target: scoreEntity({
      ...target,
      gapToTop3_30d: gap,
      recommendedWeeklyTarget: recommended,
    }),
    competitors: competitors.map(scoreEntity),
  };
}

export function momentumBadgeClass(label: MomentumLabel): string {
  switch (label) {
    case "Exploding":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
    case "Accelerating":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
    case "Healthy":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200";
    case "Stable":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
    case "Slowing":
      return "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}
