import { differenceInCalendarDays, formatDistanceToNow, subDays, startOfDay } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { hasOwnerResponse } from "@/lib/reviews/normalize";
import { buildReviewsSentimentData, extractThemeTagsFromText, type ReviewThemeInput, type ReviewsSentimentData } from "@/lib/reviews/review-themes";
import {
  calcAvgRating,
  calcResponseRate,
  loadStoredReviews,
  reviewsInWindow,
  type StoredReviewRow,
} from "@/lib/reviews/review-store";

export type ReviewListItem = {
  id: string;
  reviewerName: string;
  rating: number | null;
  reviewText: string | null;
  reviewDate: string | null;
  publishedAt: string | null;
  firstObservedAt: string | null;
  relativeDate: string | null;
  source: "google" | "facebook" | "yelp";
  tags: string[];
  replied: boolean;
  ownerResponseText: string | null;
  isTarget: boolean;
  businessName: string;
  competitorId: string | null;
  daysWaiting: number | null;
  urgency: "urgent" | "high" | "medium" | "low" | null;
  isNew: boolean;
  resolved: boolean;
  resolvedAt: string | null;
  /** Honest campaign attribution when matched — never invents confirmed. */
  campaignAttribution?: "confirmed" | "likely" | "unattributed" | null;
};

export type CompetitorSummary = {
  id: string;
  name: string;
  rating: number | null;
  totalReviews: number;
  newReviews90d: number;
  newReviewsDeltaPct: number | null;
  avgRating: number | null;
  velocitySpark: number[];
};

export type ReviewsPageData = {
  businessId: string;
  businessName: string;
  hasData: boolean;
  lastSyncedAt: string | null;
  kpis: {
    avgRating: number | null;
    avgRatingDelta: number | null;
    totalReviews: number;
    newReviews90d: number;
    newReviews90dDelta: number | null;
    reviewGap: number;
    responseRate: number;
    responseRateDelta: number | null;
    unanswered90d: number;
    avgDaysWaiting: number | null;
    urgentCount: number;
  };
  latestTargetReviews: ReviewListItem[];
  competitorActivity: Array<{
    id: string;
    name: string;
    rating: number | null;
    newReviews90d: number;
    spark: number[];
  }>;
  topKeywords: Array<{ keyword: string; count: number }>;
  competitorWinningKeywords: Array<{ keyword: string; count: number }>;
  fastestGrowingCompetitor: { name: string; rating: number | null; delta: number } | null;
  stream: ReviewListItem[];
  yourReviews: ReviewListItem[];
  competitors: CompetitorSummary[];
  competitorReviews: ReviewListItem[];
  keywordGaps: Array<{
    keyword: string;
    targetCount: number;
    competitorAvg: number;
    gap: number;
    priority: string;
  }>;
  trendingKeywords: Array<{ keyword: string; deltaPct: number }>;
  positivePct: number;
  negativePct: number;
  themeMovement: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  sentiment: ReviewsSentimentData;
  unanswered: ReviewListItem[];
  suggestions: Array<{ id: string; title: string; description: string; type: string }>;
  syncState: { needsRun: boolean; message: string | null };
};

function storedToThemeInput(
  row: StoredReviewRow,
  meta: { businessName: string; isTarget: boolean }
): ReviewThemeInput {
  return {
    id: row.id,
    reviewerName: row.reviewer_name ?? "Anonymous",
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: row.review_text,
    reviewDate: row.review_date,
    businessName: meta.businessName,
    isTarget: meta.isTarget,
  };
}

function inferSource(row: StoredReviewRow): "google" | "facebook" | "yelp" {
  const provider = (row.source_provider ?? "").toLowerCase();
  if (provider.includes("facebook")) return "facebook";
  if (provider.includes("yelp")) return "yelp";
  return "google";
}

function urgencyFromDays(days: number): "urgent" | "high" | "medium" | "low" {
  if (days >= 14) return "urgent";
  if (days >= 7) return "high";
  if (days >= 3) return "medium";
  return "low";
}

function toListItem(
  row: StoredReviewRow,
  params: { isTarget: boolean; businessName: string; now: Date }
): ReviewListItem {
  const publishedAt = row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null);
  const reviewDate = row.review_date ?? (publishedAt ? publishedAt.slice(0, 10) : null);
  const firstObservedAt = row.first_observed_at ?? row.created_at ?? null;
  const daysWaiting =
    publishedAt && !hasOwnerResponse(row.owner_response_text)
      ? differenceInCalendarDays(params.now, new Date(publishedAt))
      : null;
  const isNew =
    firstObservedAt != null &&
    differenceInCalendarDays(params.now, new Date(firstObservedAt)) <= 7;

  return {
    id: row.id,
    reviewerName: row.reviewer_name ?? "Anonymous",
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: row.review_text,
    reviewDate,
    publishedAt,
    firstObservedAt,
    relativeDate: publishedAt
      ? formatDistanceToNow(new Date(publishedAt), { addSuffix: true })
      : row.relative_date_text,
    source: inferSource(row),
    tags: extractThemeTagsFromText(row.review_text, 4),
    replied: hasOwnerResponse(row.owner_response_text),
    ownerResponseText: row.owner_response_text,
    isTarget: params.isTarget,
    businessName: params.businessName,
    competitorId: row.competitor_id,
    daysWaiting,
    urgency: daysWaiting != null && !hasOwnerResponse(row.owner_response_text) ? urgencyFromDays(daysWaiting) : null,
    isNew,
    resolved: Boolean(row.resolved_at),
    resolvedAt: row.resolved_at ?? null,
    campaignAttribution: null,
  };
}

async function loadAttributionMap(
  supabase: ReturnType<typeof createServiceClient>,
  businessId: string,
  reviewIds: string[]
): Promise<Map<string, "confirmed" | "likely" | "unattributed">> {
  const map = new Map<string, "confirmed" | "likely" | "unattributed">();
  if (!reviewIds.length) return map;
  const { data } = await supabase
    .from("review_campaign_attributions")
    .select("review_id, attribution_level")
    .eq("business_id", businessId)
    .in("review_id", reviewIds.slice(0, 200));
  for (const row of data ?? []) {
    const id = String(row.review_id);
    const level = row.attribution_level as "confirmed" | "likely" | "unattributed";
    const prev = map.get(id);
    const rank = (l: string) => (l === "confirmed" ? 3 : l === "likely" ? 2 : 1);
    if (!prev || rank(level) > rank(prev)) map.set(id, level);
  }
  return map;
}

function applyAttribution(
  items: ReviewListItem[],
  attrMap: Map<string, "confirmed" | "likely" | "unattributed">
): ReviewListItem[] {
  return items.map((item) => ({
    ...item,
    campaignAttribution: attrMap.get(item.id) ?? null,
  }));
}

function sparkFromReviews(rows: StoredReviewRow[], weeks = 8): number[] {
  const buckets = Array.from({ length: weeks }, () => 0);
  const now = new Date();
  for (const row of rows) {
    if (!row.review_date) continue;
    const daysAgo = differenceInCalendarDays(now, new Date(row.review_date));
    const weekIdx = Math.floor(daysAgo / 7);
    if (weekIdx >= 0 && weekIdx < weeks) buckets[weeks - 1 - weekIdx]++;
  }
  return buckets;
}

export async function loadReviewsPageData(businessId: string): Promise<ReviewsPageData> {
  const supabase = createServiceClient();
  const now = new Date();
  const lookbackDays = 90;

  const { data: business } = await supabase.from("businesses").select("id, name").eq("id", businessId).single();
  if (!business) throw new Error("Business not found");

  const { data: keywords } = await supabase.from("business_keywords").select("city, state, is_primary").eq("business_id", businessId);
  const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];

  const momentum = await loadLatestMomentumRun(businessId);
  const targetEntity = momentum?.entities.find((e) => e.entity_type === "target");
  const compEntities = momentum?.entities.filter((e) => e.entity_type === "competitor") ?? [];

  const competitorIds = compEntities.map((e) => e.competitor_id).filter(Boolean) as string[];

  const [targetRows, allLoadedCompRows] = await Promise.all([
    loadStoredReviews(supabase, { businessId, lookbackDays }),
    competitorIds.length
      ? loadStoredReviews(supabase, { competitorIds, lookbackDays })
      : Promise.resolve([] as StoredReviewRow[]),
  ]);
  const compRowsById = new Map<string, StoredReviewRow[]>();
  for (const compId of competitorIds) compRowsById.set(compId, []);
  for (const row of allLoadedCompRows) {
    if (!row.competitor_id) continue;
    const list = compRowsById.get(row.competitor_id) ?? [];
    list.push(row);
    compRowsById.set(row.competitor_id, list);
  }

  const allCompRows = Array.from(compRowsById.values()).flat();
  const target90 = reviewsInWindow(targetRows, 90);
  const targetPrior90 = targetRows.filter((r) => {
    if (!r.review_date) return false;
    const d = startOfDay(new Date(r.review_date));
    const priorStart = startOfDay(subDays(now, 180));
    const priorEnd = startOfDay(subDays(now, 90));
    return d >= priorStart && d < priorEnd;
  });

  const responseRate = calcResponseRate(target90);
  const priorResponseRate = calcResponseRate(targetPrior90);
  const avgRating = calcAvgRating(target90);
  const priorAvgRating = calcAvgRating(targetPrior90);

  const totalReviews = targetEntity?.total_reviews_current ?? targetRows.length;
  const newReviews90d = target90.length;
  const newReviews90dDelta = newReviews90d - targetPrior90.length;
  const reviewGap = targetEntity?.gap_to_top3_30d ?? 0;

  const unanswered = target90
    .filter((r) => !hasOwnerResponse(r.owner_response_text))
    .map((r) => toListItem(r, { isTarget: true, businessName: business.name, now }));

  const waitingDays = unanswered
    .map((r) => r.daysWaiting)
    .filter((d): d is number => d != null);
  const avgDaysWaiting =
    waitingDays.length > 0 ? Math.round((waitingDays.reduce((a, b) => a + b, 0) / waitingDays.length) * 10) / 10 : null;
  const urgentCount = unanswered.filter((r) => r.urgency === "urgent" || r.urgency === "high").length;

  const targetThemeInputs = target90.map((r) => storedToThemeInput(r, { businessName: business.name, isTarget: true }));
  const competitorGroupsForSentiment = compEntities.map((entity) => {
    const rows = entity.competitor_id ? compRowsById.get(entity.competitor_id) ?? [] : [];
    return {
      id: entity.competitor_id ?? entity.id,
      name: entity.name,
      reviews: reviewsInWindow(rows, 90).map((r) =>
        storedToThemeInput(r, { businessName: entity.name, isTarget: false })
      ),
    };
  });

  const sentiment = buildReviewsSentimentData({
    targetReviews: targetThemeInputs,
    competitors: competitorGroupsForSentiment,
    businessName: business.name,
    now,
  });

  const topKeywords = sentiment.yours.themes.map((t) => ({ keyword: t.label, count: t.reviewCount }));

  const compThemeCounts: Record<string, number> = {};
  for (const profile of sentiment.competitors) {
    for (const theme of profile.themes) {
      compThemeCounts[theme.label] = (compThemeCounts[theme.label] ?? 0) + theme.reviewCount;
    }
  }
  const competitorWinningKeywords = Object.entries(compThemeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));

  const keywordGaps = sentiment.themeComparison.map((row) => ({
    keyword: row.label,
    targetCount: row.yours,
    competitorAvg: row.competitorAvg,
    gap: Math.max(0, row.competitorAvgPct - row.yoursPct) / 10,
    priority: row.competitorAvgPct - row.yoursPct >= 20 ? "high" : row.competitorAvgPct - row.yoursPct >= 10 ? "medium" : "low",
  }));

  const trendingKeywords = sentiment.themeComparison
    .filter((row) => row.competitorAvgPct > row.yoursPct)
    .slice(0, 5)
    .map((row) => ({
      keyword: row.label,
      deltaPct: Math.max(0, row.competitorAvgPct - row.yoursPct),
    }));

  const positivePct = sentiment.yours.sentiment.positivePct;
  const negativePct = sentiment.yours.sentiment.negativePct;
  const themeMovement = sentiment.themeMovement;

  const competitors: CompetitorSummary[] = compEntities.map((entity) => {
    const rows = entity.competitor_id ? compRowsById.get(entity.competitor_id) ?? [] : [];
    const rows90 = reviewsInWindow(rows, 90);
  const prior = rows.filter((r) => {
      if (!r.review_date) return false;
      const d = startOfDay(new Date(r.review_date));
      const priorStart = startOfDay(subDays(now, 180));
      const priorEnd = startOfDay(subDays(now, 90));
      return d >= priorStart && d < priorEnd;
    });
    const deltaPct =
      prior.length > 0 ? Math.round(((rows90.length - prior.length) / prior.length) * 100) : rows90.length > 0 ? 100 : null;

    return {
      id: entity.competitor_id ?? entity.id,
      name: entity.name,
      rating: entity.rating_current != null ? Number(entity.rating_current) : null,
      totalReviews: entity.total_reviews_current ?? rows.length,
      newReviews90d: rows90.length,
      newReviewsDeltaPct: deltaPct,
      avgRating: calcAvgRating(rows90),
      velocitySpark: sparkFromReviews(rows90),
    };
  });

  const fastestGrowingCompetitor = competitors.length
    ? competitors.reduce((best, c) => (c.newReviews90d > (best?.newReviews90d ?? 0) ? c : best), competitors[0])
    : null;

  const competitorActivity = competitors.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    rating: c.rating,
    newReviews90d: c.newReviews90d,
    spark: c.velocitySpark,
  }));

  const stream: ReviewListItem[] = [
    ...target90.map((r) => toListItem(r, { isTarget: true, businessName: business.name, now })),
    ...allCompRows.map((r) => {
      const comp = compEntities.find((e) => e.competitor_id === r.competitor_id);
      return toListItem(r, { isTarget: false, businessName: comp?.name ?? "Competitor", now });
    }),
  ].sort((a, b) => {
    const da = a.reviewDate ? new Date(a.reviewDate).getTime() : 0;
    const db = b.reviewDate ? new Date(b.reviewDate).getTime() : 0;
    return db - da;
  });

  const yourReviews = target90.map((r) => toListItem(r, { isTarget: true, businessName: business.name, now }));
  const competitorReviews = allCompRows.map((r) => {
    const comp = compEntities.find((e) => e.competitor_id === r.competitor_id);
    return toListItem(r, { isTarget: false, businessName: comp?.name ?? "Competitor", now });
  });

  const { data: syncRow, error: syncError } = await supabase
    .from("review_sync_state")
    .select("last_sync_at")
    .eq("business_id", businessId)
    .maybeSingle();

  if (syncError) {
    console.warn("[ReviewsPage] review_sync_state query skipped:", syncError.message);
  }

  const suggestions: ReviewsPageData["suggestions"] = [];
  if (unanswered.length > 0) {
    suggestions.push({
      id: "reply-unanswered",
      title: `Reply to ${unanswered.length} unanswered review${unanswered.length === 1 ? "" : "s"}`,
      description: "Improve response rate and protect your rating.",
      type: "reply",
    });
  }
  if (fastestGrowingCompetitor && fastestGrowingCompetitor.newReviews90d > newReviews90d) {
    suggestions.push({
      id: "competitor-velocity",
      title: `${fastestGrowingCompetitor.name} gained ${fastestGrowingCompetitor.newReviews90d} reviews this period`,
      description: "Compare sentiment and themes to see where you can differentiate.",
      type: "competitor",
    });
  }
  if (sentiment.insights.length > 0) {
    suggestions.push({
      id: "sentiment-insight",
      title: sentiment.insights[0].title,
      description: sentiment.insights[0].description,
      type: "sentiment",
    });
  }
  suggestions.push({
    id: "request-reviews",
    title: "Send review request to recent customers",
    description: "Boost new review velocity with automated requests.",
    type: "request",
  });

  const hasData = targetRows.length > 0 || allCompRows.length > 0;

  const attrMap = await loadAttributionMap(
    supabase,
    businessId,
    target90.map((r) => r.id)
  );
  const yourReviewsAttr = applyAttribution(yourReviews, attrMap);
  const streamAttr = applyAttribution(stream, attrMap);
  const unansweredAttr = applyAttribution(
    unanswered.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0)),
    attrMap
  );

  return {
    businessId,
    businessName: business.name,
    hasData,
    lastSyncedAt: syncRow?.last_sync_at ?? momentum?.run.finished_at ?? null,
    kpis: {
      avgRating,
      avgRatingDelta:
        avgRating != null && priorAvgRating != null ? Math.round((avgRating - priorAvgRating) * 10) / 10 : null,
      totalReviews,
      newReviews90d,
      newReviews90dDelta,
      reviewGap,
      responseRate,
      responseRateDelta:
        targetPrior90.length === 0 ? null : responseRate - priorResponseRate,
      unanswered90d: unanswered.length,
      avgDaysWaiting,
      urgentCount,
    },
    latestTargetReviews: yourReviewsAttr.slice(0, 3),
    competitorActivity,
    topKeywords,
    competitorWinningKeywords,
    fastestGrowingCompetitor: fastestGrowingCompetitor
      ? {
          name: fastestGrowingCompetitor.name,
          rating: fastestGrowingCompetitor.rating,
          delta: fastestGrowingCompetitor.newReviews90d,
        }
      : null,
    stream: streamAttr,
    yourReviews: yourReviewsAttr,
    competitors,
    competitorReviews,
    keywordGaps,
    trendingKeywords,
    positivePct,
    negativePct,
    themeMovement,
    sentiment,
    unanswered: unansweredAttr,
    suggestions,
    syncState: {
      needsRun: !hasData,
      message: !hasData ? "Run Review Momentum to sync your review feed." : null,
    },
  };
}
