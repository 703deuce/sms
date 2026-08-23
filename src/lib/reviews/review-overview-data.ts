import { format, startOfDay, subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { listCampaigns } from "@/lib/reputation/campaigns";
import { auditOwnerResponses } from "@/lib/reputation/response-audit";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import {
  calcAvgRating,
  loadStoredReviews,
  storedRowToNormalized,
  type StoredReviewRow,
} from "@/lib/reviews/review-store";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-preview-data";
import { SUCCESSFUL_SEND_STATUSES } from "@/lib/reputation/provider-ids";

export type { ReviewOverviewData };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pctDelta(current: number, prior: number): number {
  if (prior <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

function countBetween(
  rows: StoredReviewRow[],
  now: Date,
  startDaysAgo: number,
  endDaysAgo: number
): number {
  // Inclusive of older bound, exclusive of newer bound.
  // e.g. previous 7d = countBetween(rows, now, 14, 7) → [now-14, now-7)
  const older = startOfDay(subDays(now, startDaysAgo));
  const newer = startOfDay(subDays(now, endDaysAgo));
  return rows.filter((r) => {
    if (!r.review_date) return false;
    const d = startOfDay(new Date(r.review_date));
    return d >= older && d < newer;
  }).length;
}

function countLastDays(rows: StoredReviewRow[], now: Date, days: number): number {
  const cutoff = startOfDay(subDays(now, days));
  return rows.filter((r) => {
    if (!r.review_date) return false;
    return startOfDay(new Date(r.review_date)) >= cutoff;
  }).length;
}

function mapMomentumLabel(
  label: string | null | undefined
): ReviewOverviewData["momentumLabel"] {
  switch (label) {
    case "Exploding":
      return "Exploding";
    case "Accelerating":
      return "Accelerating";
    case "Healthy":
      return "Healthy";
    case "Stable":
      return "Stable";
    case "Slowing":
      return "Slowing";
    case "Recovering":
      return "Recovering";
    case "Volatile":
      return "Volatile";
    case "Dormant":
    case "Stalled":
      return "Stalled";
    default:
      return "Stable";
  }
}

function momentumSubtitle(label: ReviewOverviewData["momentumLabel"]): string {
  switch (label) {
    case "Exploding":
      return "Very strong growth trend";
    case "Accelerating":
      return "Stable growth trend";
    case "Healthy":
      return "Healthy review pace";
    case "Stable":
      return "Steady review pace";
    case "Slowing":
      return "Growth is cooling off";
    case "Recovering":
      return "Pace is coming back";
    case "Volatile":
      return "Inconsistent review pace";
    case "Stalled":
      return "Review velocity has stalled";
    default:
      return "Review pace update";
  }
}

function rankByReviews90d(
  entities: Array<{
    entity_type: string;
    reviews_90d: number | null;
  }>
): { rank: number; poolSize: number } {
  const pool = entities.filter(
    (e) => e.entity_type === "target" || e.entity_type === "competitor"
  );
  const sorted = [...pool].sort(
    (a, b) => Number(b.reviews_90d ?? 0) - Number(a.reviews_90d ?? 0)
  );
  const targetIdx = sorted.findIndex((e) => e.entity_type === "target");
  return {
    rank: targetIdx >= 0 ? targetIdx + 1 : sorted.length || 1,
    poolSize: Math.max(1, sorted.length),
  };
}

function buildTrendSeries(
  targetBuckets: Array<{ label: string; count: number }> | undefined,
  competitorBuckets: Array<{ label: string; count: number }> | undefined,
  allCompetitorBuckets: Array<Array<{ label: string; count: number }>>
): ReviewOverviewData["trendSeries"] {
  const labels =
    targetBuckets?.map((b) => b.label) ??
    competitorBuckets?.map((b) => b.label) ??
    [];
  if (!labels.length) return [];

  return labels.map((label, i) => {
    const you = targetBuckets?.[i]?.count ?? 0;
    const competitor = competitorBuckets?.[i]?.count ?? 0;
    const benchVals = allCompetitorBuckets
      .map((b) => b[i]?.count)
      .filter((n): n is number => typeof n === "number");
    const benchmark =
      benchVals.length > 0
        ? Math.round((benchVals.reduce((a, b) => a + b, 0) / benchVals.length) * 10) / 10
        : 0;
    return { label, you, benchmark, competitor };
  });
}

function emptyOverview(dateRangeLabel: string): ReviewOverviewData {
  return {
    hasReviewsData: false,
    hasMapsData: false,
    hasCampaignData: false,
    dateRangeLabel,
    googleRating: null,
    competitorAvgRatingNearby: null,
    nearbyMiles: 4,
    totalReviews: 0,
    gained30d: 0,
    reviews7d: 0,
    reviews7dDeltaPct: 0,
    reviews30d: 0,
    reviews30dDeltaPct: 0,
    reviews60d: 0,
    reviews60dDeltaPct: 0,
    reviews90d: 0,
    reviews90dDeltaPct: 0,
    reviewsPerWeek: 0,
    reviewsPerMonth: 0,
    reviewsPerWeekBaseline90d: 0,
    velocitySparkline: [],
    momentumLabel: "Stable",
    momentumSubtitle: "Run Review Momentum to unlock trends",
    momentumDetail: "No review velocity data yet",
    competitorRank: null,
    competitorPoolSize: null,
    competitorRankDelta: null,
    responseRatePct: 0,
    answeredCount: 0,
    answeredOf: 0,
    unansweredNegative: 0,
    trendSeries: [],
    impactRows: [],
    mapsAvgRank: null,
    mapsAvgRankDelta: null,
    mapsRankSparkline: [],
    top3VisibilityPct: null,
    top3VisibilityDelta: null,
    top10VisibilityPct: null,
    top10VisibilityDelta: null,
    campaign: {
      sent: 0,
      clickedPct: 0,
      clickedCount: 0,
      reviews: 0,
      badReviews: 0,
      convRatePct: 0,
    },
    nextAction: {
      title: "Sync your reviews",
      body: "Run Review Momentum to load Google reviews, competitor velocity, and response insights.",
      ctaLabel: "Open Review Momentum",
    },
  };
}

async function loadMapsVisibility(businessId: string): Promise<{
  hasMapsData: boolean;
  mapsAvgRank: number | null;
  mapsAvgRankDelta: number | null;
  mapsRankSparkline: number[];
  top3VisibilityPct: number | null;
  top3VisibilityDelta: number | null;
  top10VisibilityPct: number | null;
  top10VisibilityDelta: number | null;
  nearbyMiles: number;
}> {
  const supabase = createServiceClient();
  const { data: batches } = await supabase
    .from("scan_batches")
    .select("id, created_at, finished_at, aggregate_metrics, radius_meters, status")
    .eq("business_id", businessId)
    .in("status", ["ready", "partial", "rank_ready"])
    .order("created_at", { ascending: false })
    .limit(10);

  const usable = (batches ?? []).filter((b) => {
    const m = (b.aggregate_metrics ?? {}) as Record<string, unknown>;
    return m.averageRank != null || m.visibilityScore != null || m.totalCells != null;
  });

  if (!usable.length) {
    return {
      hasMapsData: false,
      mapsAvgRank: null,
      mapsAvgRankDelta: null,
      mapsRankSparkline: [],
      top3VisibilityPct: null,
      top3VisibilityDelta: null,
      top10VisibilityPct: null,
      top10VisibilityDelta: null,
      nearbyMiles: 4,
    };
  }

  const metricsOf = (batch: (typeof usable)[number]) => {
    const m = (batch.aggregate_metrics ?? {}) as {
      averageRank?: number | null;
      top3Cells?: number;
      top10Cells?: number;
      totalCells?: number;
      visibilityScore?: number | null;
    };
    const total = Number(m.totalCells ?? 0);
    const top3 = Number(m.top3Cells ?? 0);
    const top10 =
      m.top10Cells != null
        ? Number(m.top10Cells)
        : m.visibilityScore != null && total > 0
          ? Math.round((Number(m.visibilityScore) / 100) * total)
          : 0;
    const top3Pct = total > 0 ? Math.round((top3 / total) * 1000) / 10 : null;
    const top10Pct =
      m.visibilityScore != null
        ? Number(m.visibilityScore)
        : total > 0
          ? Math.round((top10 / total) * 1000) / 10
          : null;
    return {
      avgRank: m.averageRank != null ? Number(m.averageRank) : null,
      top3Pct,
      top10Pct,
    };
  };

  // Chronological sparkline (oldest → newest), then reverse for display order of deltas
  const chronological = [...usable].reverse();
  const spark = chronological
    .map((b) => metricsOf(b).avgRank)
    .filter((n): n is number => n != null)
    .slice(-8);

  const current = metricsOf(usable[0]!);
  const previous = usable[1] ? metricsOf(usable[1]) : null;

  const radiusMeters = Number(usable[0]?.radius_meters ?? 0);
  const nearbyMiles =
    radiusMeters > 0 ? Math.max(1, Math.round((radiusMeters / 1609.34) * 10) / 10) : 4;

  return {
    hasMapsData: true,
    mapsAvgRank: current.avgRank != null ? round1(current.avgRank) : null,
    mapsAvgRankDelta:
      current.avgRank != null && previous?.avgRank != null
        ? round1(previous.avgRank - current.avgRank)
        : null,
    mapsRankSparkline: spark,
    top3VisibilityPct: current.top3Pct,
    top3VisibilityDelta:
      current.top3Pct != null && previous?.top3Pct != null
        ? round1(current.top3Pct - previous.top3Pct)
        : null,
    top10VisibilityPct: current.top10Pct,
    top10VisibilityDelta:
      current.top10Pct != null && previous?.top10Pct != null
        ? round1(current.top10Pct - previous.top10Pct)
        : null,
    nearbyMiles,
  };
}

async function loadCampaignPerformance(businessId: string): Promise<{
  hasCampaignData: boolean;
  campaign: ReviewOverviewData["campaign"];
}> {
  const supabase = createServiceClient();
  const since = subDays(new Date(), 30).toISOString();

  const campaigns = await listCampaigns(businessId).catch(() => []);
  const campaignIds = campaigns.map((c) => c.id as string);

  let sent = 0;
  let clicked = 0;

  if (campaignIds.length) {
    const { data: messages } = await supabase
      .from("review_request_messages")
      .select("status, sent_at, created_at, campaign_id")
      .in("campaign_id", campaignIds);

    for (const m of messages ?? []) {
      const when = String(m.sent_at ?? m.created_at ?? "");
      if (!when || when < since) continue;
      const s = String(m.status);
      if (s === "sent" || s === "delivered" || s === "clicked") sent++;
      if (s === "clicked") clicked++;
    }
  }

  // Include one-off review request sends in the same window.
  const { data: oneOffs } = await supabase
    .from("review_request_sends")
    .select("status, sent_at, created_at")
    .eq("business_id", businessId)
    .gte("created_at", since)
    .limit(500);

  const success = new Set<string>(SUCCESSFUL_SEND_STATUSES as readonly string[]);
  for (const row of oneOffs ?? []) {
    if (success.has(String(row.status))) sent++;
  }

  const { data: attributions } = await supabase
    .from("review_campaign_attributions")
    .select("review_id, attribution_level, detected_at")
    .eq("business_id", businessId)
    .gte("detected_at", since);

  const attributed = (attributions ?? []).filter(
    (a) => a.attribution_level === "confirmed" || a.attribution_level === "likely"
  );
  const reviewsDetected = attributed.length;
  const reviewIds = attributed
    .map((a) => a.review_id as string | null)
    .filter((id): id is string => Boolean(id));

  let badReviews = 0;
  if (reviewIds.length) {
    const { data: rated } = await supabase
      .from("business_reviews")
      .select("id, rating")
      .in("id", reviewIds);
    badReviews = (rated ?? []).filter((r) => r.rating != null && Number(r.rating) <= 2).length;
  }

  const clickedPct = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
  const convRatePct = sent > 0 ? Math.round((reviewsDetected / sent) * 100) : 0;
  const hasCampaignData = sent > 0 || reviewsDetected > 0 || campaigns.length > 0;

  return {
    hasCampaignData,
    campaign: {
      sent,
      clickedPct,
      clickedCount: clicked,
      reviews: reviewsDetected,
      badReviews,
      convRatePct,
    },
  };
}

/**
 * Assembles the Review Overview dashboard from persisted momentum, reviews,
 * maps scans, and campaign tables. Does not call external providers.
 */
export async function loadReviewOverviewData(
  businessId: string
): Promise<ReviewOverviewData> {
  const now = new Date();
  const dateRangeLabel = `${format(subDays(now, 29), "MMM d")} - ${format(now, "MMM d, yyyy")}`;
  const empty = emptyOverview(dateRangeLabel);

  const supabase = createServiceClient();

  const [{ data: business }, momentum, maps, campaignBlock] = await Promise.all([
    supabase.from("businesses").select("id, name").eq("id", businessId).maybeSingle(),
    loadLatestMomentumRun(businessId),
    loadMapsVisibility(businessId),
    loadCampaignPerformance(businessId),
  ]);

  if (!business) return empty;

  const targetRows = await loadStoredReviews(supabase, {
    businessId,
    lookbackDays: 180,
  });

  const targetEntity = momentum?.entities.find((e) => e.entity_type === "target") ?? null;
  const competitorEntities =
    momentum?.entities.filter((e) => e.entity_type === "competitor") ?? [];

  const hasReviewsData = Boolean(targetEntity) || targetRows.length > 0;

  const reviews7d = targetEntity
    ? Number(targetEntity.reviews_7d ?? 0)
    : countLastDays(targetRows, now, 7);
  const reviews30d = targetEntity
    ? Number(targetEntity.reviews_30d ?? 0)
    : countLastDays(targetRows, now, 30);
  const reviews90d = targetEntity
    ? Number(targetEntity.reviews_90d ?? 0)
    : countLastDays(targetRows, now, 90);
  const reviews60d = countLastDays(targetRows, now, 60);

  const prior7d = countBetween(targetRows, now, 14, 7);
  const prior30d = countBetween(targetRows, now, 60, 30);
  const prior60d = countBetween(targetRows, now, 120, 60);
  const prior90d = countBetween(targetRows, now, 180, 90);

  // Prefer entity totals/rating; fall back to stored rows.
  const googleRating =
    targetEntity?.rating_current != null
      ? Number(targetEntity.rating_current)
      : calcAvgRating(targetRows);

  const totalReviews =
    targetEntity?.total_reviews_current != null
      ? Number(targetEntity.total_reviews_current)
      : targetRows.length;

  const competitorRatings = competitorEntities
    .map((e) => (e.rating_current != null ? Number(e.rating_current) : null))
    .filter((n): n is number => n != null);
  const competitorAvgRatingNearby =
    competitorRatings.length > 0
      ? round1(competitorRatings.reduce((a, b) => a + b, 0) / competitorRatings.length)
      : null;

  const metricsJson = (targetEntity?.metrics_json ?? {}) as {
    weeklyCounts8w?: Array<{ week: string; count: number }>;
    trendBuckets90d?: Array<{ label: string; count: number }>;
    marketInsights?: { velocityTrendLabel?: string };
    velocityAvailable?: boolean;
  };

  const reviewsPerWeek =
    targetEntity?.avg_reviews_per_week != null
      ? Number(targetEntity.avg_reviews_per_week)
      : round1(reviews30d / 4.3);
  const reviewsPerMonth = round1(reviewsPerWeek * 4.3);
  const reviewsPerWeekBaseline90d = round1(reviews90d / (90 / 7));

  const velocitySparkline =
    metricsJson.weeklyCounts8w?.map((w) => w.count) ??
    (reviewsPerWeek > 0 ? [reviewsPerWeek] : []);

  const rawLabel = (targetEntity?.momentum_label as MomentumLabel | undefined) ?? null;
  const momentumLabel = mapMomentumLabel(rawLabel);
  const last7 = reviews7d;
  const avgWeek = reviewsPerWeekBaseline90d;
  const momentumDetail =
    rawLabel != null
      ? `${last7} reviews last week vs ${round1(avgWeek)} avg`
      : "No momentum label yet";

  const currentRank = momentum ? rankByReviews90d(momentum.entities) : null;

  let competitorRankDelta: number | null = null;
  const priorRun = momentum
    ? (
        await supabase
          .from("review_momentum_runs")
          .select("id")
          .eq("business_id", businessId)
          .in("status", ["ready", "partial"])
          .order("created_at", { ascending: false })
          .limit(2)
      ).data?.[1]
    : null;
  if (priorRun && currentRank) {
    const { data: priorEntities } = await supabase
      .from("review_momentum_entities")
      .select("entity_type, reviews_90d")
      .eq("run_id", priorRun.id);
    if (priorEntities?.length) {
      const priorRank = rankByReviews90d(priorEntities);
      competitorRankDelta = priorRank.rank - currentRank.rank;
    }
  }

  const normalized90 = targetRows
    .filter((r) => {
      if (!r.review_date) return false;
      return startOfDay(new Date(r.review_date)) >= startOfDay(subDays(now, 90));
    })
    .map(storedRowToNormalized);
  const responseAudit = auditOwnerResponses(normalized90);

  const topCompetitor = [...competitorEntities].sort(
    (a, b) => Number(b.reviews_90d ?? 0) - Number(a.reviews_90d ?? 0)
  )[0];

  const allCompBuckets = competitorEntities.map((e) => {
    const mj = (e.metrics_json ?? {}) as {
      trendBuckets90d?: Array<{ label: string; count: number }>;
    };
    return mj.trendBuckets90d ?? [];
  });

  const trendSeries = buildTrendSeries(
    metricsJson.trendBuckets90d,
    topCompetitor
      ? ((topCompetitor.metrics_json ?? {}) as {
          trendBuckets90d?: Array<{ label: string; count: number }>;
        }).trendBuckets90d
      : undefined,
    allCompBuckets
  );

  const impactSource = [
    {
      name: "You",
      reviewsGained: reviews90d,
      status: momentumLabel,
      isYou: true as const,
    },
    ...competitorEntities
      .map((e) => ({
        name: String(e.name ?? "Competitor"),
        reviewsGained: Number(e.reviews_90d ?? 0),
        status: (e.momentum_label as string | null) ?? null,
        isYou: false as const,
      }))
      .sort((a, b) => b.reviewsGained - a.reviewsGained)
      .slice(0, 3),
  ];

  const benchAvg =
    competitorEntities.length > 0
      ? Math.round(
          competitorEntities.reduce((a, e) => a + Number(e.reviews_90d ?? 0), 0) /
            competitorEntities.length
        )
      : null;

  const impactWithBench =
    benchAvg != null
      ? [
          impactSource[0]!,
          {
            name: "Benchmark Avg",
            reviewsGained: benchAvg,
            status: "Stable",
            isYou: false as const,
          },
          ...impactSource.slice(1),
        ]
      : impactSource;

  const maxImpact = Math.max(...impactWithBench.map((r) => r.reviewsGained), 1);
  const impactRows = impactWithBench.slice(0, 4).map((row) => ({
    ...row,
    barPct: Math.max(8, Math.round((row.reviewsGained / maxImpact) * 100)),
  }));

  // Recommended next action: unanswered negatives > momentum tasks > generic
  let nextAction: ReviewOverviewData["nextAction"] = empty.nextAction;
  if (responseAudit.unansweredNegative > 0) {
    nextAction = {
      title: "Boost your momentum",
      body: `You have ${responseAudit.unansweredNegative} unanswered negative review${
        responseAudit.unansweredNegative === 1 ? "" : "s"
      } that can hurt conversion. Respond to these first.`,
      ctaLabel: "Respond to Reviews",
    };
  } else if (momentum?.tasks?.length) {
    const task = [...momentum.tasks].sort((a, b) => {
      const rank = (p: string) => {
        const v = String(p).toLowerCase();
        if (v.includes("high")) return 0;
        if (v.includes("medium")) return 1;
        return 2;
      };
      return rank(String(a.priority)) - rank(String(b.priority));
    })[0]!;
    nextAction = {
      title: String(task.title ?? "Recommended action"),
      body: String(task.description ?? "Complete this action to improve review momentum."),
      ctaLabel: "View Action Plan",
    };
  } else if (hasReviewsData && reviews30d < reviewsPerWeekBaseline90d * 2) {
    nextAction = {
      title: "Request more reviews",
      body: "Your recent review pace is below your 90-day baseline. Send review requests to recent customers.",
      ctaLabel: "Send Review Requests",
    };
  } else if (hasReviewsData) {
    nextAction = {
      title: "Keep your momentum",
      body: "Your review velocity looks healthy. Stay consistent with responses and review requests.",
      ctaLabel: "Open Review Feed",
    };
  }

  return {
    hasReviewsData,
    hasMapsData: maps.hasMapsData,
    hasCampaignData: campaignBlock.hasCampaignData,
    dateRangeLabel,
    googleRating,
    competitorAvgRatingNearby,
    nearbyMiles: maps.nearbyMiles,
    totalReviews,
    gained30d: reviews30d,
    reviews7d,
    reviews7dDeltaPct: pctDelta(reviews7d, prior7d),
    reviews30d,
    reviews30dDeltaPct: pctDelta(reviews30d, prior30d),
    reviews60d,
    reviews60dDeltaPct: pctDelta(reviews60d, prior60d),
    reviews90d,
    reviews90dDeltaPct: pctDelta(reviews90d, prior90d),
    reviewsPerWeek,
    reviewsPerMonth,
    reviewsPerWeekBaseline90d,
    velocitySparkline,
    momentumLabel,
    momentumSubtitle: momentumSubtitle(momentumLabel),
    momentumDetail,
    competitorRank: currentRank?.rank ?? null,
    competitorPoolSize: currentRank?.poolSize ?? null,
    competitorRankDelta,
    responseRatePct: Math.round(responseAudit.responseRate),
    answeredCount: responseAudit.answered,
    answeredOf: responseAudit.totalWithText,
    unansweredNegative: responseAudit.unansweredNegative,
    trendSeries,
    impactRows,
    mapsAvgRank: maps.mapsAvgRank,
    mapsAvgRankDelta: maps.mapsAvgRankDelta,
    mapsRankSparkline: maps.mapsRankSparkline,
    top3VisibilityPct: maps.top3VisibilityPct,
    top3VisibilityDelta: maps.top3VisibilityDelta,
    top10VisibilityPct: maps.top10VisibilityPct,
    top10VisibilityDelta: maps.top10VisibilityDelta,
    campaign: campaignBlock.campaign,
    nextAction,
  };
}
