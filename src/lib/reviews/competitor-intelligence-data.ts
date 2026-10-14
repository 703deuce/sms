import { addMonths, differenceInCalendarDays, formatDistanceToNow, subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { hasOwnerResponse } from "@/lib/reviews/normalize";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import {
  calcAvgRating,
  calcResponseRate,
  loadStoredReviews,
  reviewsInWindow,
  type StoredReviewRow,
} from "@/lib/reviews/review-store";
import {
  REVIEW_THEME_CATEGORIES,
  buildThemeBreakdown,
  classifyReviewSentiment,
  extractThemeTagsFromText,
  type ReviewThemeInput,
} from "@/lib/reviews/review-themes";

export type CompetitorLeaderboardRow = {
  id: string;
  name: string;
  isYou: boolean;
  totalReviews: number;
  rating: number | null;
  reviews30: number;
  reviews60: number;
  reviews90: number;
  deltas?: {
    reviews30?: number;
    reviews60?: number;
    reviews90?: number;
  };
  reviewsPerMonth: number;
  momentumLabel: string;
  responseRate: number;
  responseSpeedDaysAvg: number | null;
};

export type CompetitorGapRow = {
  competitorId: string;
  competitorName: string;
  totalGap: number;
  monthlyVelocityGap: number;
  neededToCatch: number;
  pace3Months: number;
  pace6Months: number;
  pace12Months: number;
  estimatedCatchUp: string;
  estimatedCatchUpDate: string | null;
  estimatedCatchUpMonths: number | null;
  warning: string | null;
  gapExpanding: boolean;
};

export type CompetitorThemeStrength = {
  label: string;
  count: number;
};

export type CompetitorMentionCount = {
  term: string;
  count: number;
};

export type CompetitorServiceGapRow = {
  label: string;
  yourMentions: number;
  competitorMentions: number;
  gap: number;
};

export type CompetitorContentComparison = {
  avgLength: number;
  pctWithText: number;
  locationTerms: number;
  serviceTerms: number;
  employeeMentions: number;
  pctGeneric: number;
  pctDetailed: number;
};

export type CompetitorIntelligenceData = {
  businessId: string;
  businessName: string;
  requiredPaceOverride?: number;
  leaderboardRows: CompetitorLeaderboardRow[];
  gapRows: CompetitorGapRow[];
  /** You + competitor reviews for the Reviews research workspace (newest first). */
  reviewsFeed: ReviewListItem[];
  complaintPatterns: Array<{
    theme: string;
    competitorMentions: number;
    yourMentions: number;
    gap: number;
  }>;
  positioningOpportunities: Array<{
    title: string;
    description: string;
    sourceTheme: string;
  }>;
  strengths: {
    positive: CompetitorThemeStrength[];
    negative: CompetitorThemeStrength[];
    competitorPositive: CompetitorThemeStrength[];
    competitorNegative: CompetitorThemeStrength[];
    serviceGaps: CompetitorServiceGapRow[];
    frequentlyPraisedServices: CompetitorMentionCount[];
    frequentlyMentionedEmployees: CompetitorMentionCount[];
  };
  contentComparison: {
    you: CompetitorContentComparison;
    competitors: CompetitorContentComparison;
  };
};

function toFeedItem(
  row: StoredReviewRow,
  params: { isTarget: boolean; businessName: string; competitorId: string | null; now: Date }
): ReviewListItem {
  const publishedAt = row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null);
  const reviewDate = row.review_date ?? (publishedAt ? publishedAt.slice(0, 10) : null);
  const firstObservedAt = row.first_observed_at ?? row.created_at ?? null;
  const replied = hasOwnerResponse(row.owner_response_text);
  const daysWaiting =
    publishedAt && !replied ? differenceInCalendarDays(params.now, new Date(publishedAt)) : null;
  const isNew =
    firstObservedAt != null && differenceInCalendarDays(params.now, new Date(firstObservedAt)) <= 7;
  const provider = (row.source_provider ?? "").toLowerCase();
  const source: ReviewListItem["source"] = provider.includes("facebook")
    ? "facebook"
    : provider.includes("yelp")
      ? "yelp"
      : "google";

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
      : reviewDate
        ? formatDistanceToNow(new Date(`${reviewDate}T12:00:00Z`), { addSuffix: true })
        : null,
    source,
    tags: extractThemeTagsFromText(row.review_text ?? "", 5),
    replied,
    ownerResponseText: row.owner_response_text,
    isTarget: params.isTarget,
    businessName: params.businessName,
    competitorId: params.competitorId,
    daysWaiting,
    urgency: daysWaiting != null ? (daysWaiting >= 14 ? "urgent" : daysWaiting >= 7 ? "high" : daysWaiting >= 3 ? "medium" : "low") : null,
    isNew,
    resolved: Boolean(row.resolved_at),
    resolvedAt: row.resolved_at ?? null,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

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

function countSince(rows: StoredReviewRow[], days: number): number {
  return reviewsInWindow(rows, days).length;
}

const SERVICE_TERM_SIGNALS = [
  "repair",
  "installation",
  "install",
  "replacement",
  "maintenance",
  "cleaning",
  "estimate",
  "inspection",
  "project",
  "job",
  "service",
  "appointment",
  "emergency",
  "consultation",
];

const COMMON_LOCATION_WORDS = new Set([
  "Downtown",
  "Midtown",
  "Uptown",
  "Northside",
  "Southside",
  "Eastside",
  "Westside",
  "Georgetown",
  "Springfield",
  "Franklin",
  "Clinton",
  "Arlington",
  "Madison",
  "Greenville",
  "Riverside",
  "Fairview",
  "Oakwood",
  "Lakewood",
  "Woodbridge",
  "Alexandria",
  "Richmond",
  "Dallas",
  "Austin",
  "Houston",
  "Phoenix",
  "Denver",
  "Charlotte",
  "Raleigh",
  "Orlando",
  "Tampa",
  "Miami",
  "Seattle",
  "Portland",
  "Boston",
  "Chicago",
  "Atlanta",
  "Nashville",
]);

function addTerm(counts: Map<string, Set<string>>, term: string, rowId: string) {
  const normalized = term.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length < 3) return;
  const current = counts.get(normalized) ?? new Set<string>();
  current.add(rowId);
  counts.set(normalized, current);
}

function extractCapitalizedLocations(text: string): string[] {
  const locations = new Set<string>();
  const afterPreposition = text.match(/\b(?:in|from|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g) ?? [];
  for (const match of afterPreposition) {
    const loc = match.replace(/^(?:in|from|near|around)\s+/i, "").trim();
    if (!/^(The|Our|This|That|They|Google|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/.test(loc)) {
      locations.add(loc);
    }
  }
  for (const word of COMMON_LOCATION_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(text)) locations.add(word);
  }
  return Array.from(locations);
}

function extractEmployeeNames(text: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /\b(?:with|by|named|technician|tech|manager)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:was|were|did|helped|arrived|called)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1]?.trim();
      if (name && !/^(The|Our|Their|This|That|Google|Customer Service)\b/.test(name)) names.add(name);
    }
  }
  return Array.from(names);
}

function extractServiceTerms(text: string): string[] {
  const terms = new Set<string>();
  const lower = text.toLowerCase();
  for (const tag of extractThemeTagsFromText(text, 6)) {
    if (/service|quality|cleanup|care|staff|crew|professional|customer|speed|scheduling|pricing|communication/i.test(tag)) {
      terms.add(tag);
    }
  }
  for (const signal of SERVICE_TERM_SIGNALS) {
    if (lower.includes(signal)) terms.add(signal);
  }
  for (const category of REVIEW_THEME_CATEGORIES) {
    if (category.signals.some((signal) => lower.includes(signal.toLowerCase()))) {
      terms.add(category.label);
    }
  }
  return Array.from(terms);
}

function mentionCounts(rows: StoredReviewRow[], extractor: (text: string) => string[], limit = 10): CompetitorMentionCount[] {
  const counts = new Map<string, Set<string>>();
  for (const row of rows) {
    const text = row.review_text ?? "";
    if (!text.trim()) continue;
    for (const term of extractor(text)) {
      addTerm(counts, term, row.id);
    }
  }
  return Array.from(counts.entries())
    .map(([term, rowIds]) => ({ term, count: rowIds.size }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

function contentComparison(rows: StoredReviewRow[]): CompetitorContentComparison {
  if (!rows.length) {
    return {
      avgLength: 0,
      pctWithText: 0,
      locationTerms: 0,
      serviceTerms: 0,
      employeeMentions: 0,
      pctGeneric: 0,
      pctDetailed: 0,
    };
  }
  const withText = rows.filter((row) => (row.review_text ?? "").trim().length > 0);
  const totalLength = withText.reduce((sum, row) => sum + (row.review_text ?? "").trim().length, 0);
  let generic = 0;
  let detailed = 0;
  let locationTerms = 0;
  let serviceTerms = 0;
  let employeeMentions = 0;
  for (const row of rows) {
    const text = (row.review_text ?? "").trim();
    const services = text ? extractServiceTerms(text) : [];
    const locations = text ? extractCapitalizedLocations(text) : [];
    const employees = text ? extractEmployeeNames(text) : [];
    const detailCount = services.length + locations.length + employees.length;
    locationTerms += locations.length;
    serviceTerms += services.length;
    employeeMentions += employees.length;
    if (!text || ((text.length < 30 || /^(great|excellent|good|bad|terrible|awesome|amazing) service[.!]?$/i.test(text)) && detailCount === 0)) {
      generic++;
    }
    if (text.length >= 120 || detailCount >= 2) {
      detailed++;
    }
  }
  return {
    avgLength: withText.length ? Math.round(totalLength / withText.length) : 0,
    pctWithText: Math.round((withText.length / rows.length) * 100),
    locationTerms,
    serviceTerms,
    employeeMentions,
    pctGeneric: Math.round((generic / rows.length) * 100),
    pctDetailed: Math.round((detailed / rows.length) * 100),
  };
}

function responseSpeedDaysAvg(rows: StoredReviewRow[]): number | null {
  const durations: number[] = [];
  for (const row of rows) {
    if (!row.owner_response_text?.trim() || !row.owner_responded_at) continue;
    const published = row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null);
    if (!published) continue;
    const days = differenceInCalendarDays(new Date(row.owner_responded_at), new Date(published));
    if (Number.isFinite(days) && days >= 0) durations.push(days);
  }
  if (!durations.length) return null;
  return round1(durations.reduce((sum, days) => sum + days, 0) / durations.length);
}

function themeCounts(inputs: ReviewThemeInput[]): CompetitorThemeStrength[] {
  return buildThemeBreakdown(inputs)
    .slice(0, 8)
    .map((theme) => ({ label: theme.label, count: theme.reviewCount }));
}

export async function loadCompetitorIntelligenceData(
  businessId: string
): Promise<CompetitorIntelligenceData> {
  const supabase = createServiceClient();
  const [{ data: business }, momentum] = await Promise.all([
    supabase.from("businesses").select("id, name").eq("id", businessId).maybeSingle(),
    loadLatestMomentumRun(businessId),
  ]);

  if (!business) throw new Error("Business not found");

  const businessName = String(business.name ?? "Your business");
  const targetEntity = momentum?.entities.find((entity) => entity.entity_type === "target");
  const competitorEntities = momentum?.entities.filter((entity) => entity.entity_type === "competitor") ?? [];
  const competitorIds = competitorEntities.map((entity) => entity.competitor_id).filter(Boolean) as string[];

  const [targetRows180, allCompetitorRows180] = await Promise.all([
    loadStoredReviews(supabase, { businessId, lookbackDays: 180 }),
    competitorIds.length ? loadStoredReviews(supabase, { competitorIds, lookbackDays: 180 }) : Promise.resolve([]),
  ]);

  const rowsByCompetitor = new Map<string, StoredReviewRow[]>();
  for (const id of competitorIds) rowsByCompetitor.set(id, []);
  for (const row of allCompetitorRows180) {
    if (!row.competitor_id) continue;
    const rows = rowsByCompetitor.get(row.competitor_id) ?? [];
    rows.push(row);
    rowsByCompetitor.set(row.competitor_id, rows);
  }

  const targetRows90 = reviewsInWindow(targetRows180, 90);
  const targetReviews30 = countSince(targetRows180, 30);
  const targetReviews60 = countSince(targetRows180, 60);
  const targetTotal = Number(targetEntity?.total_reviews_current ?? targetRows180.length);
  const targetMonthlyVelocity = targetReviews30;

  const leaderboardRows: CompetitorLeaderboardRow[] = [
    {
      id: businessId,
      name: businessName,
      isYou: true,
      totalReviews: targetTotal,
      rating: targetEntity?.rating_current != null ? Number(targetEntity.rating_current) : calcAvgRating(targetRows90),
      reviews30: targetReviews30,
      reviews60: targetReviews60,
      reviews90: targetRows90.length,
      reviewsPerMonth: round1(targetRows90.length / 3),
      momentumLabel: String(targetEntity?.momentum_label ?? "Stable"),
      responseRate: calcResponseRate(targetRows90),
      responseSpeedDaysAvg: responseSpeedDaysAvg(targetRows90),
    },
    ...competitorEntities.map((entity) => {
      const rows = entity.competitor_id ? rowsByCompetitor.get(entity.competitor_id) ?? [] : [];
      const rows90 = reviewsInWindow(rows, 90);
      return {
        id: entity.competitor_id ?? entity.id,
        name: String(entity.name ?? "Competitor"),
        isYou: false,
        totalReviews: Number(entity.total_reviews_current ?? rows.length),
        rating: entity.rating_current != null ? Number(entity.rating_current) : calcAvgRating(rows90),
        reviews30: countSince(rows, 30),
        reviews60: countSince(rows, 60),
        reviews90: rows90.length,
        reviewsPerMonth: round1(rows90.length / 3),
        momentumLabel: String(entity.momentum_label ?? "Stable"),
        responseRate: calcResponseRate(rows90),
        responseSpeedDaysAvg: responseSpeedDaysAvg(rows90),
      };
    }),
  ].sort((a, b) => b.totalReviews - a.totalReviews);

  const gapRows: CompetitorGapRow[] = competitorEntities.map((entity) => {
    const id = entity.competitor_id ?? entity.id;
    const rows = entity.competitor_id ? rowsByCompetitor.get(entity.competitor_id) ?? [] : [];
    const totalReviews = Number(entity.total_reviews_current ?? rows.length);
    const competitorVelocity = countSince(rows, 30);
    const totalGap = totalReviews - targetTotal;
    const monthlyVelocityGap = competitorVelocity - targetMonthlyVelocity;
    const neededToCatch = Math.max(0, totalGap + 1);
    const relativeMonthlyGain = targetMonthlyVelocity - competitorVelocity;
    const estimatedCatchUpMonths =
      neededToCatch <= 0
        ? 0
        : relativeMonthlyGain > 0
          ? Math.ceil(neededToCatch / relativeMonthlyGain)
          : null;
    const estimatedCatchUpDate =
      estimatedCatchUpMonths != null && estimatedCatchUpMonths > 0
        ? addMonths(new Date(), estimatedCatchUpMonths).toISOString().slice(0, 10)
        : neededToCatch <= 0
          ? new Date().toISOString().slice(0, 10)
          : null;
    const estimatedCatchUp =
      neededToCatch <= 0
        ? "Caught up"
        : estimatedCatchUpMonths != null
          ? `${estimatedCatchUpMonths} mo`
          : "Not at current pace";
    const projectedGap = (months: number) =>
      Math.round(totalReviews + competitorVelocity * months - (targetTotal + targetMonthlyVelocity * months));
    const gapExpanding = monthlyVelocityGap > 0;

    return {
      competitorId: id,
      competitorName: String(entity.name ?? "Competitor"),
      totalGap,
      monthlyVelocityGap,
      neededToCatch,
      pace3Months: projectedGap(3),
      pace6Months: projectedGap(6),
      pace12Months: projectedGap(12),
      estimatedCatchUp,
      estimatedCatchUpDate,
      estimatedCatchUpMonths,
      warning: gapExpanding
        ? `${entity.name ?? "Competitor"} is adding ${monthlyVelocityGap} more reviews per month, so the gap is widening.`
        : estimatedCatchUpMonths == null && neededToCatch > 0
          ? "At the current monthly pace, this competitor will remain ahead."
          : null,
      gapExpanding,
    };
  });

  const competitorNameById = new Map(
    competitorEntities.map((entity) => [entity.competitor_id ?? entity.id, String(entity.name ?? "Competitor")])
  );
  const competitorRows90 = allCompetitorRows180.filter((row) => {
    if (!row.review_date) return false;
    return new Date(row.review_date) >= subDays(new Date(), 90);
  });

  const targetThemeInputs = targetRows90.map((row) =>
    storedToThemeInput(row, { businessName, isTarget: true })
  );
  const competitorThemeInputs = competitorRows90.map((row) =>
    storedToThemeInput(row, {
      businessName: competitorNameById.get(row.competitor_id ?? "") ?? "Competitor",
      isTarget: false,
    })
  );

  const positiveTarget = targetThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "positive"
  );
  const negativeTarget = targetThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "negative"
  );
  const positiveCompetitors = competitorThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "positive"
  );
  const negativeCompetitors = competitorThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "negative"
  );

  const yourNegativeThemes = themeCounts(negativeTarget);
  const competitorNegativeThemes = themeCounts(negativeCompetitors);
  const yourPositiveThemes = themeCounts(positiveTarget);
  const competitorPositiveThemes = themeCounts(positiveCompetitors);
  const yourPositiveByTheme = new Map(yourPositiveThemes.map((theme) => [theme.label, theme.count]));
  const serviceGaps = competitorPositiveThemes
    .map((theme) => {
      const yourMentions = yourPositiveByTheme.get(theme.label) ?? 0;
      return {
        label: theme.label,
        yourMentions,
        competitorMentions: theme.count,
        gap: theme.count - yourMentions,
      };
    })
    .filter((row) => row.gap > 0)
    .sort((a, b) => b.gap - a.gap || b.competitorMentions - a.competitorMentions)
    .slice(0, 8);
  const yourNegativeByTheme = new Map(yourNegativeThemes.map((theme) => [theme.label, theme.count]));
  const complaintPatterns = competitorNegativeThemes
    .map((theme) => {
      const yourMentions = yourNegativeByTheme.get(theme.label) ?? 0;
      return {
        theme: theme.label,
        competitorMentions: theme.count,
        yourMentions,
        gap: theme.count - yourMentions,
      };
    })
    .filter((row) => row.gap > 0)
    .slice(0, 8);

  const positioningOpportunities = complaintPatterns.slice(0, 5).map((pattern) => ({
    title: `Position against ${pattern.theme.toLowerCase()} complaints`,
    description: `Competitor negative reviews mention ${pattern.theme.toLowerCase()} ${pattern.competitorMentions} times vs ${pattern.yourMentions} for you. Highlight your process for avoiding this issue in review requests, replies, and sales copy.`,
    sourceTheme: pattern.theme,
  }));

  const now = new Date();
  const reviewsFeed: ReviewListItem[] = [
    ...targetRows180.map((row) =>
      toFeedItem(row, { isTarget: true, businessName, competitorId: null, now })
    ),
    ...allCompetitorRows180.map((row) =>
      toFeedItem(row, {
        isTarget: false,
        businessName: competitorNameById.get(row.competitor_id ?? "") ?? "Competitor",
        competitorId: row.competitor_id,
        now,
      })
    ),
  ]
    .sort((a, b) => {
      const aDate = a.publishedAt ?? (a.reviewDate ? `${a.reviewDate}T00:00:00Z` : "");
      const bDate = b.publishedAt ?? (b.reviewDate ? `${b.reviewDate}T00:00:00Z` : "");
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })
    .slice(0, 400);

  return {
    businessId,
    businessName,
    leaderboardRows,
    gapRows,
    reviewsFeed,
    complaintPatterns,
    positioningOpportunities,
    strengths: {
      positive: themeCounts(positiveTarget),
      negative: themeCounts(negativeTarget),
      competitorPositive: competitorPositiveThemes,
      competitorNegative: themeCounts(negativeCompetitors),
      serviceGaps,
      frequentlyPraisedServices: mentionCounts(
        positiveTarget
          .map((review) => targetRows90.find((row) => row.id === review.id))
          .filter((row): row is StoredReviewRow => Boolean(row)),
        extractServiceTerms
      ),
      frequentlyMentionedEmployees: mentionCounts(targetRows90, extractEmployeeNames),
    },
    contentComparison: {
      you: contentComparison(targetRows90),
      competitors: contentComparison(competitorRows90),
    },
  };
}
