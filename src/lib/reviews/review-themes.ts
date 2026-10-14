export type ReviewThemeId =
  | "service_quality"
  | "speed_scheduling"
  | "pricing_value"
  | "communication"
  | "professionalism"
  | "reliability_trust"
  | "cleanup_care"
  | "staff_crew"
  | "ease_convenience"
  | "hard_work"
  | "customer_service"
  | "overall_satisfaction";

export type ReviewThemeCategory = {
  id: ReviewThemeId;
  label: string;
  signals: string[];
};

/** Curated business themes — not raw tokens or location words. */
export const REVIEW_THEME_CATEGORIES: ReviewThemeCategory[] = [
  {
    id: "service_quality",
    label: "Service Quality",
    signals: [
      "great job",
      "excellent",
      "outstanding",
      "quality work",
      "exceeded expectations",
      "exceeded my expectations",
      "amazing job",
      "well done",
      "did a great job",
      "top notch",
      "high quality",
    ],
  },
  {
    id: "speed_scheduling",
    label: "Speed & Scheduling",
    signals: [
      "fast",
      "quick",
      "quickly",
      "same day",
      "same-day",
      "prompt",
      "on time",
      "punctual",
      "efficient",
      "timely",
      "arrived on time",
      "showed up on time",
      "last minute",
    ],
  },
  {
    id: "pricing_value",
    label: "Pricing & Value",
    signals: [
      "affordable",
      "fair price",
      "reasonable",
      "great price",
      "worth it",
      "good price",
      "fair pricing",
      "very reasonable",
      "excellent pricing",
      "competitive price",
      "good value",
    ],
  },
  {
    id: "communication",
    label: "Communication",
    signals: [
      "communicative",
      "responsive",
      "communication",
      "kept me updated",
      "easy to reach",
      "great communication",
      "great communications",
      "quick to respond",
      "answered",
    ],
  },
  {
    id: "professionalism",
    label: "Professionalism",
    signals: [
      "professional",
      "friendly",
      "courteous",
      "polite",
      "respectful",
      "courtesy",
      "very professional",
      "extremely professional",
    ],
  },
  {
    id: "reliability_trust",
    label: "Reliability & Trust",
    signals: [
      "recommend",
      "reliable",
      "honest",
      "trust",
      "dependable",
      "would use again",
      "highly recommend",
      "will definitely use",
      "use again",
      "use them again",
    ],
  },
  {
    id: "cleanup_care",
    label: "Cleanup & Care",
    signals: [
      "clean",
      "no damage",
      "no damages",
      "careful",
      "left clean",
      "tidy",
      "without damage",
      "handled with care",
    ],
  },
  {
    id: "staff_crew",
    label: "Staff & Crew",
    signals: ["crew", "team", "guys", "workers", "staff", "his crew", "the team", "everyone was"],
  },
  {
    id: "ease_convenience",
    label: "Ease & Convenience",
    signals: ["easy", "hassle-free", "hassle free", "smooth", "simple", "convenient", "stress-free", "stress free"],
  },
  {
    id: "hard_work",
    label: "Hard Work & Effort",
    signals: [
      "worked hard",
      "above and beyond",
      "went above",
      "hard working",
      "incredibly hard",
      "put in the work",
      "didn't stop",
    ],
  },
  {
    id: "customer_service",
    label: "Customer Service",
    signals: ["customer service", "helpful", "accommodating", "attentive", "took care of", "work with you"],
  },
  {
    id: "overall_satisfaction",
    label: "Overall Satisfaction",
    signals: [
      "satisfied",
      "very satisfied",
      "happy",
      "pleased",
      "love",
      "great experience",
      "excellent experience",
      "five stars",
      "5 stars",
    ],
  },
];

const POSITIVE_SIGNALS = [
  "great",
  "excellent",
  "amazing",
  "love",
  "recommend",
  "professional",
  "friendly",
  "fast",
  "outstanding",
  "satisfied",
  "happy",
  "perfect",
  "wonderful",
  "best",
];

const NEGATIVE_SIGNALS = [
  "bad",
  "slow",
  "rude",
  "terrible",
  "awful",
  "never",
  "worst",
  "disappointed",
  "horrible",
  "unprofessional",
  "damaged",
  "late",
  "overcharged",
  "no show",
];

export type SentimentBreakdown = {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
};

export type ThemeBreakdown = {
  themeId: ReviewThemeId;
  label: string;
  reviewCount: number;
  pct: number;
};

export type ThemeReviewRef = {
  id: string;
  reviewerName: string;
  rating: number | null;
  reviewDate: string | null;
  reviewText: string | null;
  businessName: string;
  isTarget: boolean;
  matchedPhrases: string[];
};

export type ThemeDetail = ThemeBreakdown & {
  matchedPhrases: string[];
  reviews: ThemeReviewRef[];
};

export type EntityThemeProfile = {
  id: string;
  label: string;
  isTarget: boolean;
  reviewCount: number;
  sentiment: SentimentBreakdown;
  themes: ThemeBreakdown[];
  themeDetails: ThemeDetail[];
};

export type CompetitorSentimentProfile = {
  id: string;
  name: string;
  reviewCount: number;
  sentiment: SentimentBreakdown;
  themes: ThemeBreakdown[];
};

export type ThemeComparisonRow = {
  themeId: ReviewThemeId;
  label: string;
  yours: number;
  yoursPct: number;
  competitorAvg: number;
  competitorAvgPct: number;
  topCompetitor: string | null;
  topCompetitorPct: number;
};

export type SentimentMovementPoint = {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
};

export type EntitySentimentSeries = {
  id: string;
  label: string;
  isTarget: boolean;
  series: SentimentMovementPoint[];
};

export type ReviewsSentimentData = {
  yours: {
    sentiment: SentimentBreakdown;
    themes: ThemeBreakdown[];
  };
  competitors: CompetitorSentimentProfile[];
  entities: EntityThemeProfile[];
  marketSentiment: SentimentBreakdown;
  themeComparison: ThemeComparisonRow[];
  themeMovement: SentimentMovementPoint[];
  entityMovement: EntitySentimentSeries[];
  insights: Array<{ id: string; title: string; description: string }>;
};

export type ReviewThemeInput = {
  id: string;
  reviewerName: string;
  rating: number | null;
  reviewText: string | null;
  reviewDate: string | null;
  businessName: string;
  isTarget: boolean;
};

function textIncludesSignal(text: string, signal: string): boolean {
  return text.toLowerCase().includes(signal.toLowerCase());
}

export function getMatchedSignals(text: string, category: ReviewThemeCategory): string[] {
  if (!text.trim()) return [];
  return category.signals.filter((signal) => textIncludesSignal(text, signal));
}

export type HighlightSegment = {
  text: string;
  highlight: boolean;
};

/** Split review text into segments, marking phrases that triggered a theme match. */
export function buildHighlightSegments(text: string, phrases: string[]): HighlightSegment[] {
  const trimmed = text.trim();
  if (!trimmed) return [{ text: "", highlight: false }];
  if (!phrases.length) return [{ text: trimmed, highlight: false }];

  const lower = trimmed.toLowerCase();
  const sorted = [...new Set(phrases.map((p) => p.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );

  const ranges: Array<{ start: number; end: number }> = [];

  for (const phrase of sorted) {
    const needle = phrase.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      const end = idx + needle.length;
      const overlaps = ranges.some((r) => !(end <= r.start || idx >= r.end));
      if (!overlaps) ranges.push({ start: idx, end });
      idx += needle.length;
    }
  }

  ranges.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: trimmed.slice(cursor, range.start), highlight: false });
    }
    segments.push({ text: trimmed.slice(range.start, range.end), highlight: true });
    cursor = range.end;
  }
  if (cursor < trimmed.length) {
    segments.push({ text: trimmed.slice(cursor), highlight: false });
  }

  return segments.length ? segments : [{ text: trimmed, highlight: false }];
}

export function reviewMatchesTheme(text: string, category: ReviewThemeCategory): boolean {
  return getMatchedSignals(text, category).length > 0;
}

export function classifyReviewSentiment(
  text: string | null,
  rating: number | null
): "positive" | "negative" | "neutral" {
  const t = (text ?? "").toLowerCase();
  const hasNeg = NEGATIVE_SIGNALS.some((s) => t.includes(s));
  const hasPos = POSITIVE_SIGNALS.some((s) => t.includes(s));

  if (rating != null && rating <= 2) return "negative";
  if (rating != null && rating >= 4 && !hasNeg) return "positive";
  if (hasNeg && !hasPos) return "negative";
  if (hasPos) return "positive";
  if (rating != null && rating >= 4) return "positive";
  if (rating != null && rating <= 2) return "negative";
  return "neutral";
}

export function buildSentimentBreakdown(reviews: ReviewThemeInput[]): SentimentBreakdown {
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  for (const review of reviews) {
    const bucket = classifyReviewSentiment(review.reviewText, review.rating);
    if (bucket === "positive") positive++;
    else if (bucket === "negative") negative++;
    else neutral++;
  }

  const total = reviews.length;
  if (total === 0) {
    return { positive: 0, negative: 0, neutral: 0, total: 0, positivePct: 0, negativePct: 0, neutralPct: 0 };
  }

  return {
    positive,
    negative,
    neutral,
    total,
    positivePct: Math.round((positive / total) * 100),
    negativePct: Math.round((negative / total) * 100),
    neutralPct: Math.round((neutral / total) * 100),
  };
}

export function buildThemeBreakdown(reviews: ReviewThemeInput[]): ThemeBreakdown[] {
  const total = reviews.length || 1;
  return REVIEW_THEME_CATEGORIES.map((category) => {
    const reviewCount = reviews.filter((r) => reviewMatchesTheme(r.reviewText ?? "", category)).length;
    return {
      themeId: category.id,
      label: category.label,
      reviewCount,
      pct: Math.round((reviewCount / total) * 100),
    };
  })
    .filter((t) => t.reviewCount > 0)
    .sort((a, b) => b.reviewCount - a.reviewCount);
}

export function buildThemeDetails(reviews: ReviewThemeInput[]): ThemeDetail[] {
  const total = reviews.length || 1;

  return REVIEW_THEME_CATEGORIES.map((category) => {
    const matching = reviews
      .map((review) => {
        const matchedPhrases = getMatchedSignals(review.reviewText ?? "", category);
        if (!matchedPhrases.length) return null;
        return {
          id: review.id,
          reviewerName: review.reviewerName,
          rating: review.rating,
          reviewDate: review.reviewDate,
          reviewText: review.reviewText,
          businessName: review.businessName,
          isTarget: review.isTarget,
          matchedPhrases,
        };
      })
      .filter((r): r is ThemeReviewRef => r != null);

    const topPhrases = Array.from(new Set(matching.flatMap((r) => r.matchedPhrases))).slice(0, 6);

    return {
      themeId: category.id,
      label: category.label,
      reviewCount: matching.length,
      pct: Math.round((matching.length / total) * 100),
      matchedPhrases: topPhrases,
      reviews: matching,
    };
  })
    .filter((t) => t.reviewCount > 0)
    .sort((a, b) => b.reviewCount - a.reviewCount);
}

export function buildThemeComparison(
  targetReviews: ReviewThemeInput[],
  competitorProfiles: CompetitorSentimentProfile[]
): ThemeComparisonRow[] {
  const targetTotal = targetReviews.length || 1;

  return REVIEW_THEME_CATEGORIES.map((category) => {
    const yours = targetReviews.filter((r) => reviewMatchesTheme(r.reviewText ?? "", category)).length;
    const yoursPct = Math.round((yours / targetTotal) * 100);

    const compPcts = competitorProfiles.map((c) => {
      const theme = c.themes.find((t) => t.themeId === category.id);
      return {
        name: c.name,
        pct: theme?.pct ?? 0,
        count: theme?.reviewCount ?? 0,
      };
    });

    const competitorAvg =
      compPcts.length > 0 ? compPcts.reduce((sum, c) => sum + c.count, 0) / compPcts.length : 0;
    const competitorAvgPct =
      compPcts.length > 0 ? Math.round(compPcts.reduce((sum, c) => sum + c.pct, 0) / compPcts.length) : 0;

    const leader = compPcts.reduce(
      (best, c) => (c.pct > (best?.pct ?? -1) ? c : best),
      compPcts[0] ?? null
    );

    return {
      themeId: category.id,
      label: category.label,
      yours,
      yoursPct,
      competitorAvg: Math.round(competitorAvg * 10) / 10,
      competitorAvgPct,
      topCompetitor: leader && leader.pct > 0 ? leader.name : null,
      topCompetitorPct: leader?.pct ?? 0,
    };
  })
    .filter((row) => row.yours > 0 || row.competitorAvg > 0)
    .sort((a, b) => b.competitorAvgPct - a.competitorAvgPct || b.yoursPct - a.yoursPct);
}

export function buildSentimentMovement(
  reviews: ReviewThemeInput[],
  weeks = 12,
  now = new Date()
): SentimentMovementPoint[] {
  const points: SentimentMovementPoint[] = [];

  for (let w = weeks; w >= 0; w--) {
    const end = new Date(now);
    end.setDate(end.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const weekRows = reviews.filter((r) => {
      if (!r.reviewDate) return false;
      const d = new Date(r.reviewDate);
      return d >= start && d <= end;
    });

    let positive = 0;
    let negative = 0;
    let neutral = 0;
    for (const row of weekRows) {
      const bucket = classifyReviewSentiment(row.reviewText, row.rating);
      if (bucket === "positive") positive++;
      else if (bucket === "negative") negative++;
      else neutral++;
    }

    points.push({
      date: end.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      positive,
      neutral,
      negative,
    });
  }

  return points;
}

export function buildSentimentInsights(
  yours: ThemeBreakdown[],
  competitors: CompetitorSentimentProfile[],
  comparison: ThemeComparisonRow[]
): ReviewsSentimentData["insights"] {
  const insights: ReviewsSentimentData["insights"] = [];

  const gaps = comparison
    .filter((row) => row.competitorAvgPct > row.yoursPct + 10)
    .slice(0, 3);

  for (const row of gaps) {
    insights.push({
      id: `gap-${row.themeId}`,
      title: `${row.label} appears more in competitor reviews`,
      description: `Competitors average ${row.competitorAvgPct}% of reviews vs ${row.yoursPct}% for you. Read those reviews to see what customers valued — then improve the service itself.`,
    });
  }

  const strengths = yours.filter((t) => t.pct >= 25).slice(0, 2);
  for (const theme of strengths) {
    insights.push({
      id: `strength-${theme.themeId}`,
      title: `Customers praise your ${theme.label.toLowerCase()}`,
      description: `${theme.pct}% of your reviews (${theme.reviewCount}) mention ${theme.label.toLowerCase()}. Use these reviews in marketing and owner replies.`,
    });
  }

  const negLeaders = competitors.filter((c) => c.sentiment.negativePct > 15).slice(0, 1);
  for (const comp of negLeaders) {
    insights.push({
      id: `comp-neg-${comp.id}`,
      title: `${comp.name} has more negative sentiment`,
      description: `${comp.sentiment.negativePct}% of their recent reviews skew negative — an area where you can differentiate.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "sync-more",
      title: "Build your theme baseline",
      description: "As more reviews sync in, themes will map to the actual reviews they came from.",
    });
  }

  return insights.slice(0, 4);
}

export function buildReviewsSentimentData(params: {
  targetReviews: ReviewThemeInput[];
  competitors: Array<{ id: string; name: string; reviews: ReviewThemeInput[] }>;
  businessName: string;
  now?: Date;
}): ReviewsSentimentData {
  const now = params.now ?? new Date();
  const yoursSentiment = buildSentimentBreakdown(params.targetReviews);
  const yoursThemes = buildThemeBreakdown(params.targetReviews);
  const yoursDetails = buildThemeDetails(params.targetReviews);

  const competitorProfiles: CompetitorSentimentProfile[] = params.competitors.map((c) => ({
    id: c.id,
    name: c.name,
    reviewCount: c.reviews.length,
    sentiment: buildSentimentBreakdown(c.reviews),
    themes: buildThemeBreakdown(c.reviews),
  }));

  const entities: EntityThemeProfile[] = [
    {
      id: "target",
      label: params.businessName,
      isTarget: true,
      reviewCount: params.targetReviews.length,
      sentiment: yoursSentiment,
      themes: yoursThemes,
      themeDetails: yoursDetails,
    },
    ...params.competitors.map((c) => ({
      id: c.id,
      label: c.name,
      isTarget: false,
      reviewCount: c.reviews.length,
      sentiment: buildSentimentBreakdown(c.reviews),
      themes: buildThemeBreakdown(c.reviews),
      themeDetails: buildThemeDetails(c.reviews),
    })),
  ];

  const allCompReviews = params.competitors.flatMap((c) => c.reviews);
  const themeComparison = buildThemeComparison(params.targetReviews, competitorProfiles);
  const themeMovement = buildSentimentMovement(params.targetReviews, 12, now);

  const entityMovement: EntitySentimentSeries[] = entities.map((e) => ({
    id: e.id,
    label: e.isTarget ? "Your business" : e.label,
    isTarget: e.isTarget,
    series: buildSentimentMovement(
      e.isTarget ? params.targetReviews : (params.competitors.find((c) => c.id === e.id)?.reviews ?? []),
      12,
      now
    ),
  }));

  const insights = buildSentimentInsights(yoursThemes, competitorProfiles, themeComparison);

  return {
    yours: { sentiment: yoursSentiment, themes: yoursThemes },
    competitors: competitorProfiles,
    entities,
    marketSentiment: allCompReviews.length > 0 ? buildSentimentBreakdown(allCompReviews) : yoursSentiment,
    themeComparison,
    themeMovement,
    entityMovement,
    insights,
  };
}

/** Tags shown on review cards — theme labels only, not location tokens. */
export function extractThemeTagsFromText(text: string | null, limit = 4): string[] {
  if (!text?.trim()) return [];
  const matched = REVIEW_THEME_CATEGORIES.filter((cat) => reviewMatchesTheme(text, cat)).map((cat) => cat.label);
  return matched.slice(0, limit);
}

export function reviewListItemToThemeInput(item: {
  id: string;
  reviewerName: string;
  rating: number | null;
  reviewText: string | null;
  reviewDate: string | null;
  businessName: string;
  isTarget: boolean;
}): ReviewThemeInput {
  return {
    id: item.id,
    reviewerName: item.reviewerName,
    rating: item.rating,
    reviewText: item.reviewText,
    reviewDate: item.reviewDate,
    businessName: item.businessName,
    isTarget: item.isTarget,
  };
}
