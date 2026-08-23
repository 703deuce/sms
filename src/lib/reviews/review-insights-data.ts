import { differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { auditOwnerResponsesFromStored, type ResponseQualityRow, type ResponseQualitySummary } from "@/lib/reputation/response-audit";
import { hasOwnerResponse } from "@/lib/reviews/normalize";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import {
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

export type ReviewInsightTheme = {
  label: string;
  count: number;
  pct: number;
};

export type ReviewInsightThemeFrequency = {
  label: string;
  recent30: number;
  prior30: number;
  delta: number;
};

export type ReviewInsightCompetitorTheme = {
  label: string;
  yourCount: number;
  competitorCount: number;
  competitorAvg: number;
  gap: number;
};

export type ReviewInsightThemeTrendPoint = {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
};

export type ReviewInsightCompetitorComparison = {
  theme: string;
  you: number;
  topCompetitor: number;
  secondCompetitor: number;
  industryAvg: number;
};

export type ReviewInsightServiceRow = {
  label: string;
  count: number;
  pct: number;
};

export type ReviewInsightsData = {
  businessId: string;
  businessName: string;
  dataUpdatedAt?: string;
  metrics: {
    positiveThemeMentions: number;
    negativeThemeMentions: number;
    totalReviewText: number;
    pctWithText?: number;
    avgReviewLength: number | null;
    reviewsWithPhotos: number | null;
    photosPct?: number;
    employeeMentions: number;
  };
  themes: {
    positive: ReviewInsightTheme[];
    negative: ReviewInsightTheme[];
    emerging: Array<ReviewInsightTheme & { delta: number }>;
    themeFrequencyOverTime: ReviewInsightThemeFrequency[];
    themeTrend30d?: ReviewInsightThemeTrendPoint[];
    competitorThemes: ReviewInsightCompetitorTheme[];
    competitorComparison?: ReviewInsightCompetitorComparison[];
    services?: ReviewInsightServiceRow[];
    locations?: ReviewInsightServiceRow[];
  };
  servicesAndKeywords: Array<{ keyword: string; count: number }>;
  categorizedKeywords: Record<
    "services" | "cities" | "employees" | "pricing" | "speed" | "communication",
    Array<{ keyword: string; count: number }>
  >;
  responsePerformance: {
    responseRate: number;
    totalWithText: number;
    answered: number;
    unansweredPositive: number;
    unansweredNegative: number;
    unansweredNeutral: number;
    avgResponseTimeDays: number | null;
    positiveResponseRate: number;
    negativeResponseRate: number;
    oldestUnansweredAt: string | null;
    oldestUnansweredDays: number | null;
  };
  responseQuality: {
    genericResponseSuspected: number;
    genericResponsePct: number;
    qualitySummary: ResponseQualitySummary;
    rows: ResponseQualityRow[];
  };
};

type ResponseTimingRow = {
  id: string;
  review_date: string | null;
  published_at?: string | null;
  owner_responded_at?: string | null;
  owner_response_text: string | null;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "business",
  "company",
  "could",
  "from",
  "great",
  "have",
  "just",
  "really",
  "service",
  "that",
  "their",
  "them",
  "they",
  "this",
  "very",
  "were",
  "what",
  "when",
  "with",
  "would",
  "your",
]);

const CATEGORY_SIGNALS = {
  pricing: REVIEW_THEME_CATEGORIES.find((theme) => theme.id === "pricing_value")?.signals ?? [],
  speed: REVIEW_THEME_CATEGORIES.find((theme) => theme.id === "speed_scheduling")?.signals ?? [],
  communication: REVIEW_THEME_CATEGORIES.find((theme) => theme.id === "communication")?.signals ?? [],
  services: [
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
  ],
} as const;

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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function storedToThemeInput(row: StoredReviewRow, businessName: string, isTarget = true): ReviewThemeInput {
  return {
    id: row.id,
    reviewerName: row.reviewer_name ?? "Anonymous",
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: row.review_text,
    reviewDate: row.review_date,
    businessName,
    isTarget,
  };
}

function mapThemeBreakdown(inputs: ReviewThemeInput[]): ReviewInsightTheme[] {
  return buildThemeBreakdown(inputs).map((theme) => ({
    label: theme.label,
    count: theme.reviewCount,
    pct: theme.pct,
  }));
}

function extractKeywordMentions(rows: StoredReviewRow[]): Array<{ keyword: string; count: number }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const tag of extractThemeTagsFromText(row.review_text, 4)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    const text = (row.review_text ?? "").toLowerCase();
    const words = text.match(/[a-z][a-z'-]{3,}/g) ?? [];
    const uniqueWords = new Set(words.filter((word) => !STOP_WORDS.has(word)));
    for (const word of uniqueWords) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));
}

function addMention(counts: Map<string, Set<string>>, keyword: string, rowId: string) {
  const normalized = keyword.trim().replace(/\s+/g, " ");
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

function extractSignalMentions(text: string, signals: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return signals.filter((signal) => lower.includes(signal.toLowerCase()));
}

function extractCategorizedKeywords(
  rows: StoredReviewRow[]
): ReviewInsightsData["categorizedKeywords"] {
  const counts = {
    services: new Map<string, Set<string>>(),
    cities: new Map<string, Set<string>>(),
    employees: new Map<string, Set<string>>(),
    pricing: new Map<string, Set<string>>(),
    speed: new Map<string, Set<string>>(),
    communication: new Map<string, Set<string>>(),
  };

  for (const row of rows) {
    const text = row.review_text ?? "";
    if (!text.trim()) continue;
    const id = row.id;

    for (const tag of extractThemeTagsFromText(text, 6)) {
      if (/service|quality|customer|cleanup|care|staff|crew|professional/i.test(tag)) {
        addMention(counts.services, tag, id);
      }
    }
    for (const signal of extractSignalMentions(text, CATEGORY_SIGNALS.services)) {
      addMention(counts.services, signal, id);
    }
    for (const signal of extractSignalMentions(text, CATEGORY_SIGNALS.pricing)) {
      addMention(counts.pricing, signal, id);
    }
    for (const signal of extractSignalMentions(text, CATEGORY_SIGNALS.speed)) {
      addMention(counts.speed, signal, id);
    }
    for (const signal of extractSignalMentions(text, CATEGORY_SIGNALS.communication)) {
      addMention(counts.communication, signal, id);
    }
    for (const location of extractCapitalizedLocations(text)) {
      addMention(counts.cities, location, id);
    }
    for (const employee of extractEmployeeNames(text)) {
      addMention(counts.employees, employee, id);
    }
    if (/\b(crew|team|staff|technician|tech)\b/i.test(text)) {
      addMention(counts.employees, "Staff / crew", id);
    }
  }

  const toRows = (map: Map<string, Set<string>>) =>
    Array.from(map.entries())
      .map(([keyword, ids]) => ({ keyword, count: ids.size }))
      .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
      .slice(0, 15);

  return {
    services: toRows(counts.services),
    cities: toRows(counts.cities),
    employees: toRows(counts.employees),
    pricing: toRows(counts.pricing),
    speed: toRows(counts.speed),
    communication: toRows(counts.communication),
  };
}

function dateForRow(row: StoredReviewRow): Date | null {
  const raw = row.published_at ?? row.review_date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function rowsBetweenDaysAgo(rows: StoredReviewRow[], olderDaysAgo: number, newerDaysAgo: number): StoredReviewRow[] {
  const now = new Date();
  const start = startOfDay(subDays(now, olderDaysAgo));
  const end = startOfDay(subDays(now, newerDaysAgo));
  return rows.filter((row) => {
    if (row.is_deleted) return false;
    const date = dateForRow(row);
    if (!date) return false;
    const day = startOfDay(date);
    return day >= start && day < end;
  });
}

function buildThemeFrequencyOverTime(
  recentRows: StoredReviewRow[],
  priorRows: StoredReviewRow[],
  businessName: string
): ReviewInsightThemeFrequency[] {
  const recent = mapThemeBreakdown(recentRows.map((row) => storedToThemeInput(row, businessName)));
  const prior = mapThemeBreakdown(priorRows.map((row) => storedToThemeInput(row, businessName)));
  const recentByLabel = new Map(recent.map((theme) => [theme.label, theme.count]));
  const priorByLabel = new Map(prior.map((theme) => [theme.label, theme.count]));
  return Array.from(new Set([...recentByLabel.keys(), ...priorByLabel.keys()]))
    .map((label) => {
      const recent30 = recentByLabel.get(label) ?? 0;
      const prior30 = priorByLabel.get(label) ?? 0;
      return { label, recent30, prior30, delta: recent30 - prior30 };
    })
    .sort((a, b) => b.recent30 + b.prior30 - (a.recent30 + a.prior30) || b.delta - a.delta)
    .slice(0, 8);
}

function buildCompetitorThemeComparison(params: {
  targetInputs: ReviewThemeInput[];
  competitorInputs: ReviewThemeInput[];
  competitorCount: number;
}): ReviewInsightCompetitorTheme[] {
  if (params.competitorCount === 0 || params.competitorInputs.length === 0) return [];
  const yourThemes = mapThemeBreakdown(params.targetInputs);
  const competitorThemes = mapThemeBreakdown(params.competitorInputs);
  const yourByLabel = new Map(yourThemes.map((theme) => [theme.label, theme.count]));
  const competitorByLabel = new Map(competitorThemes.map((theme) => [theme.label, theme.count]));
  return Array.from(new Set([...yourByLabel.keys(), ...competitorByLabel.keys()]))
    .map((label) => {
      const yourCount = yourByLabel.get(label) ?? 0;
      const competitorCount = competitorByLabel.get(label) ?? 0;
      const competitorAvg = round1(competitorCount / params.competitorCount);
      return {
        label,
        yourCount,
        competitorCount,
        competitorAvg,
        gap: round1(competitorAvg - yourCount),
      };
    })
    .sort((a, b) => b.competitorAvg - a.competitorAvg || b.yourCount - a.yourCount)
    .slice(0, 10);
}

function sentimentResponseRate(
  rows: StoredReviewRow[],
  sentiment: "positive" | "negative"
): number {
  const matching = rows.filter((row) =>
    classifyReviewSentiment(row.review_text, row.rating != null ? Number(row.rating) : null) === sentiment
  );
  if (!matching.length) return 0;
  const answered = matching.filter((row) => hasOwnerResponse(row.owner_response_text)).length;
  return Math.round((answered / matching.length) * 100);
}

function oldestUnanswered(rows: StoredReviewRow[]): { at: string | null; days: number | null } {
  const unanswered = rows
    .filter((row) => !hasOwnerResponse(row.owner_response_text))
    .map((row) => dateForRow(row))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());
  const oldest = unanswered[0];
  if (!oldest) return { at: null, days: null };
  return {
    at: oldest.toISOString().slice(0, 10),
    days: Math.max(0, differenceInCalendarDays(new Date(), oldest)),
  };
}

async function loadResponseTimingRows(businessId: string): Promise<ResponseTimingRow[]> {
  const supabase = createServiceClient();
  const cutoff = subDays(new Date(), 90).toISOString().slice(0, 10);
  const withExactColumns = await supabase
    .from("business_reviews")
    .select("id, review_date, published_at, owner_responded_at, owner_response_text")
    .eq("business_id", businessId)
    .gte("review_date", cutoff)
    .order("review_date", { ascending: false })
    .limit(500);

  if (!withExactColumns.error) {
    return (withExactColumns.data ?? []) as ResponseTimingRow[];
  }

  const fallback = await supabase
    .from("business_reviews")
    .select("id, review_date, owner_response_text")
    .eq("business_id", businessId)
    .gte("review_date", cutoff)
    .order("review_date", { ascending: false })
    .limit(500);

  return (fallback.data ?? []) as ResponseTimingRow[];
}

function avgResponseTimeDays(rows: ResponseTimingRow[]): number | null {
  const durations: number[] = [];
  for (const row of rows) {
    if (!row.owner_response_text?.trim() || !row.owner_responded_at) continue;
    const published = row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null);
    if (!published) continue;
    const days = differenceInCalendarDays(new Date(row.owner_responded_at), new Date(published));
    if (Number.isFinite(days) && days >= 0) durations.push(days);
  }
  if (!durations.length) return null;
  return Math.round((durations.reduce((sum, days) => sum + days, 0) / durations.length) * 10) / 10;
}

export async function loadReviewInsightsData(businessId: string): Promise<ReviewInsightsData> {
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) throw new Error("Business not found");
  const businessName = String(business.name ?? "Your business");

  const [storedRows, timingRows, momentum] = await Promise.all([
    loadStoredReviews(supabase, { businessId, lookbackDays: 180 }),
    loadResponseTimingRows(businessId),
    loadLatestMomentumRun(businessId),
  ]);
  const competitorEntities = momentum?.entities.filter((entity) => entity.entity_type === "competitor") ?? [];
  const competitorIds = competitorEntities.map((entity) => entity.competitor_id).filter(Boolean) as string[];
  const competitorRows = competitorIds.length
    ? await loadStoredReviews(supabase, { competitorIds, lookbackDays: 90 })
    : [];
  const competitorNameById = new Map(
    competitorEntities.map((entity) => [entity.competitor_id ?? entity.id, String(entity.name ?? "Competitor")])
  );

  const currentRows = reviewsInWindow(storedRows, 90);
  const recent30Rows = reviewsInWindow(storedRows, 30);
  const prior30Rows = rowsBetweenDaysAgo(storedRows, 60, 30);
  const priorRows = storedRows.filter((row) => {
    if (!row.review_date) return false;
    const date = new Date(row.review_date);
    const now = new Date();
    return date >= subDays(now, 180) && date < subDays(now, 90);
  });

  const currentInputs = currentRows.map((row) => storedToThemeInput(row, businessName));
  const competitorInputs = reviewsInWindow(competitorRows, 90).map((row) =>
    storedToThemeInput(row, competitorNameById.get(row.competitor_id ?? "") ?? "Competitor", false)
  );
  const positiveInputs = currentInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "positive"
  );
  const negativeInputs = currentInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "negative"
  );

  const currentThemes = mapThemeBreakdown(currentInputs);
  const positiveThemes = mapThemeBreakdown(positiveInputs).slice(0, 8);
  const negativeThemes = mapThemeBreakdown(negativeInputs).slice(0, 8);
  const priorThemeCounts = new Map(
    mapThemeBreakdown(priorRows.map((row) => storedToThemeInput(row, businessName))).map((theme) => [
      theme.label,
      theme.count,
    ])
  );
  const emerging = currentThemes
    .map((theme) => ({ ...theme, delta: theme.count - (priorThemeCounts.get(theme.label) ?? 0) }))
    .filter((theme) => theme.delta > 0)
    .sort((a, b) => b.delta - a.delta || b.count - a.count)
    .slice(0, 8);

  const responseAudit = auditOwnerResponsesFromStored(currentRows.map((row) => ({
    id: row.id,
    rating: row.rating,
    review_text: row.review_text,
    owner_response_text: row.owner_response_text,
    published_at: row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null),
    owner_responded_at: row.owner_responded_at ?? null,
    reviewer_name: row.reviewer_name,
  })));
  const genericPct =
    responseAudit.answered > 0
      ? Math.round((responseAudit.genericResponseSuspected / responseAudit.answered) * 100)
      : 0;
  const oldest = oldestUnanswered(currentRows);
  const textLengths = currentRows
    .map((row) => row.review_text?.trim().length ?? 0)
    .filter((length) => length > 0);
  const categorizedKeywords = extractCategorizedKeywords(currentRows);

  return {
    businessId,
    businessName,
    metrics: {
      positiveThemeMentions: positiveThemes.reduce((sum, theme) => sum + theme.count, 0),
      negativeThemeMentions: negativeThemes.reduce((sum, theme) => sum + theme.count, 0),
      totalReviewText: textLengths.length,
      avgReviewLength: textLengths.length
        ? Math.round(textLengths.reduce((sum, length) => sum + length, 0) / textLengths.length)
        : null,
      reviewsWithPhotos: null,
      employeeMentions: categorizedKeywords.employees.reduce((sum, item) => sum + item.count, 0),
    },
    themes: {
      positive: positiveThemes,
      negative: negativeThemes,
      emerging,
      themeFrequencyOverTime: buildThemeFrequencyOverTime(recent30Rows, prior30Rows, businessName),
      competitorThemes: buildCompetitorThemeComparison({
        targetInputs: currentInputs,
        competitorInputs,
        competitorCount: competitorIds.length,
      }),
    },
    servicesAndKeywords: extractKeywordMentions(currentRows),
    categorizedKeywords,
    responsePerformance: {
      responseRate: responseAudit.responseRate,
      totalWithText: responseAudit.totalWithText,
      answered: responseAudit.answered,
      unansweredPositive: responseAudit.unansweredPositive,
      unansweredNegative: responseAudit.unansweredNegative,
      unansweredNeutral: responseAudit.unansweredNeutral,
      avgResponseTimeDays: responseAudit.avgResponseTimeDays ?? avgResponseTimeDays(timingRows),
      positiveResponseRate: sentimentResponseRate(currentRows, "positive"),
      negativeResponseRate: sentimentResponseRate(currentRows, "negative"),
      oldestUnansweredAt: oldest.at,
      oldestUnansweredDays: oldest.days,
    },
    responseQuality: {
      genericResponseSuspected: responseAudit.genericResponseSuspected,
      genericResponsePct: genericPct,
      qualitySummary: responseAudit.qualitySummary,
      rows: responseAudit.responseQualityRows,
    },
  };
}
