/** Preview / mockup numbers for Review Overview (Intelligence). */
export const REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID = "preview-review-overview";

export type ReviewOverviewMomentumLabel =
  | "Exploding"
  | "Accelerating"
  | "Healthy"
  | "Stable"
  | "Slowing"
  | "Stalled"
  | "Recovering"
  | "Volatile";

export type ReviewOverviewData = {
  hasReviewsData: boolean;
  hasMapsData: boolean;
  hasCampaignData: boolean;
  dateRangeLabel: string;
  googleRating: number | null;
  competitorAvgRatingNearby: number | null;
  nearbyMiles: number;
  totalReviews: number;
  gained30d: number;
  reviews7d: number;
  reviews7dDeltaPct: number;
  reviews30d: number;
  reviews30dDeltaPct: number;
  reviews60d: number;
  reviews60dDeltaPct: number;
  reviews90d: number;
  reviews90dDeltaPct: number;
  reviewsPerWeek: number;
  reviewsPerMonth: number;
  reviewsPerWeekBaseline90d: number;
  velocitySparkline: number[];
  momentumLabel: ReviewOverviewMomentumLabel;
  momentumSubtitle: string;
  momentumDetail: string;
  competitorRank: number | null;
  competitorPoolSize: number | null;
  competitorRankDelta: number | null;
  responseRatePct: number;
  answeredCount: number;
  answeredOf: number;
  unansweredNegative: number;
  trendSeries: Array<{
    label: string;
    you: number;
    benchmark: number;
    competitor: number;
  }>;
  impactRows: Array<{
    name: string;
    reviewsGained: number;
    status: string | null;
    isYou?: boolean;
    barPct: number;
  }>;
  mapsAvgRank: number | null;
  mapsAvgRankDelta: number | null;
  mapsRankSparkline: number[];
  top3VisibilityPct: number | null;
  top3VisibilityDelta: number | null;
  top10VisibilityPct: number | null;
  top10VisibilityDelta: number | null;
  campaign: {
    sent: number;
    clickedPct: number;
    clickedCount: number;
    reviews: number;
    badReviews: number;
    convRatePct: number;
  };
  nextAction: {
    title: string;
    body: string;
    ctaLabel: string;
  };
};

export const reviewOverviewPreviewData: ReviewOverviewData = {
  hasReviewsData: true,
  hasMapsData: true,
  hasCampaignData: true,
  dateRangeLabel: "May 27 - Jun 25, 2024",
  googleRating: 4.6,
  competitorAvgRatingNearby: 4.5,
  nearbyMiles: 4,
  totalReviews: 327,
  gained30d: 23,
  reviews7d: 9,
  reviews7dDeltaPct: 20,
  reviews30d: 34,
  reviews30dDeltaPct: 15,
  reviews60d: 42,
  reviews60dDeltaPct: 5,
  reviews90d: 71,
  reviews90dDeltaPct: 8,
  reviewsPerWeek: 2.8,
  reviewsPerMonth: 11.7,
  reviewsPerWeekBaseline90d: 2.3,
  velocitySparkline: [1.8, 2.0, 2.1, 2.4, 2.2, 2.6, 2.5, 2.8],
  momentumLabel: "Accelerating",
  momentumSubtitle: "Stable growth trend",
  momentumDetail: "8 reviews last week vs 6 avg",
  competitorRank: 2,
  competitorPoolSize: 12,
  competitorRankDelta: 1,
  responseRatePct: 82,
  answeredCount: 21,
  answeredOf: 23,
  unansweredNegative: 3,
  trendSeries: [
    { label: "Mar 1", you: 12, benchmark: 10, competitor: 8 },
    { label: "Mar 15", you: 18, benchmark: 14, competitor: 11 },
    { label: "Apr 1", you: 22, benchmark: 16, competitor: 13 },
    { label: "Apr 15", you: 28, benchmark: 19, competitor: 15 },
    { label: "May 1", you: 35, benchmark: 22, competitor: 18 },
    { label: "May 15", you: 48, benchmark: 26, competitor: 21 },
    { label: "Jun 1", you: 58, benchmark: 30, competitor: 24 },
    { label: "Jun 25", you: 71, benchmark: 34, competitor: 28 },
  ],
  impactRows: [
    { name: "You", reviewsGained: 34, status: "Accelerating", isYou: true, barPct: 100 },
    { name: "Benchmark Avg", reviewsGained: 22, status: "Stable", barPct: 65 },
    { name: "Standout Trash", reviewsGained: 18, status: null, barPct: 53 },
    { name: "All Star Junk", reviewsGained: 12, status: null, barPct: 35 },
  ],
  mapsAvgRank: 5.1,
  mapsAvgRankDelta: 1.2,
  mapsRankSparkline: [6.4, 6.1, 5.9, 5.7, 5.5, 5.4, 5.2, 5.1],
  top3VisibilityPct: 62,
  top3VisibilityDelta: 2.1,
  top10VisibilityPct: 88,
  top10VisibilityDelta: -1.1,
  campaign: {
    sent: 340,
    clickedPct: 35,
    clickedCount: 119,
    reviews: 42,
    badReviews: 0,
    convRatePct: 12,
  },
  nextAction: {
    title: "Boost your momentum",
    body: "You have 3 unanswered negative reviews that are hurting your conversion rate. Respond to these first.",
    ctaLabel: "Respond to Reviews",
  },
};
