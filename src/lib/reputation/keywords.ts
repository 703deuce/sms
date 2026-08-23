import type { NormalizedReview } from "@/lib/reviews/normalize";

export type KeywordType = "service" | "trust" | "location" | "price" | "speed" | "emergency" | "quality";

const HOME_SERVICE_KEYWORDS: Record<KeywordType, string[]> = {
  service: [
    "junk removal",
    "furniture removal",
    "appliance removal",
    "mattress removal",
    "garage cleanout",
    "estate cleanout",
    "construction debris",
    "yard waste",
    "cleanout",
    "haul away",
    "pickup",
    "demolition",
  ],
  trust: [
    "fast",
    "professional",
    "affordable",
    "fair price",
    "on time",
    "friendly",
    "responsive",
    "clean",
    "careful",
    "easy",
    "recommend",
    "honest",
    "reliable",
  ],
  location: [],
  price: ["affordable", "fair price", "reasonable", "great price", "worth it"],
  speed: ["fast", "quick", "same-day", "same day", "prompt", "on time"],
  emergency: ["same-day", "same day", "urgent", "emergency", "last minute"],
  quality: ["professional", "careful", "thorough", "excellent", "outstanding"],
};

export function buildKeywordDictionary(locationTokens: string[]): Record<KeywordType, string[]> {
  const dict = { ...HOME_SERVICE_KEYWORDS };
  dict.location = locationTokens.map((t) => t.toLowerCase()).filter(Boolean);
  return dict;
}

function countInText(text: string, keyword: string): number {
  const t = text.toLowerCase();
  const k = keyword.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = t.indexOf(k, idx)) !== -1) {
    count++;
    idx += k.length;
  }
  return count;
}

export function extractKeywordsFromReview(
  review: NormalizedReview,
  dictionary: Record<KeywordType, string[]>
): { service: string[]; trust: string[]; location: string[] } {
  const text = (review.reviewText ?? "").toLowerCase();
  const service: string[] = [];
  const trust: string[] = [];
  const location: string[] = [];

  for (const kw of dictionary.service) {
    if (countInText(text, kw) > 0) service.push(kw);
  }
  for (const kw of dictionary.trust) {
    if (countInText(text, kw) > 0 && !trust.includes(kw)) trust.push(kw);
  }
  for (const kw of dictionary.location) {
    if (countInText(text, kw) > 0) location.push(kw);
  }

  return { service, trust, location };
}

export type KeywordGapRow = {
  keyword: string;
  keywordType: KeywordType;
  targetCount: number;
  competitorAvg: number;
  competitorMax: number;
  gap: number;
  priority: "high" | "medium" | "low";
  recommendation: string;
};

export function computeKeywordGaps(params: {
  targetReviews: NormalizedReview[];
  competitorReviews: NormalizedReview[][];
  dictionary: Record<KeywordType, string[]>;
}): KeywordGapRow[] {
  const gaps: KeywordGapRow[] = [];
  const types: KeywordType[] = ["service", "trust", "location", "speed", "emergency"];

  for (const type of types) {
    for (const keyword of params.dictionary[type] ?? []) {
      const targetCount = params.targetReviews.filter((r) =>
        countInText(r.reviewText ?? "", keyword)
      ).length;

      const compCounts = params.competitorReviews.map(
        (revs) => revs.filter((r) => countInText(r.reviewText ?? "", keyword)).length
      );
      const competitorAvg =
        compCounts.length > 0 ? compCounts.reduce((a, b) => a + b, 0) / compCounts.length : 0;
      const competitorMax = compCounts.length > 0 ? Math.max(...compCounts) : 0;
      const gap = Math.max(0, competitorAvg - targetCount);

      if (targetCount === 0 && competitorAvg < 0.5) continue;

      const priority: "high" | "medium" | "low" =
        gap >= 3 || (targetCount === 0 && competitorMax >= 2)
          ? "high"
          : gap >= 1
            ? "medium"
            : "low";

      gaps.push({
        keyword,
        keywordType: type,
        targetCount,
        competitorAvg: Math.round(competitorAvg * 10) / 10,
        competitorMax,
        gap: Math.round(gap * 10) / 10,
        priority,
        recommendation:
          targetCount === 0 && competitorAvg > 0
            ? `Competitors earn organic praise for "${keyword}" in reviews. You have few mentions — focus on delivering that experience.`
            : gap > 0
              ? `Competitors average ${competitorAvg.toFixed(1)} reviews mentioning "${keyword}" vs your ${targetCount}.`
              : `You match competitors on "${keyword}".`,
      });
    }
  }

  return gaps.sort((a, b) => b.gap - a.gap || b.competitorMax - a.competitorMax);
}

export function aggregateKeywordStrengths(reviews: NormalizedReview[], dictionary: Record<KeywordType, string[]>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const type of Object.keys(dictionary) as KeywordType[]) {
    for (const kw of dictionary[type]) {
      const n = reviews.filter((r) => countInText(r.reviewText ?? "", kw) > 0).length;
      if (n > 0) counts[kw] = n;
    }
  }
  return counts;
}
