import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";

export const REVIEW_FEED_PREVIEW_BUSINESS_ID = "preview-review-feed";

export type ReviewFeedDetails = {
  reviewId: string;
  publishedDateTime: string;
  location: string;
  lastEditedAt: string | null;
  edited?: boolean;
  sentiment: {
    label: "Positive" | "Neutral" | "Negative";
    confidence: number; // 0–1 decimal
  };
};

export type ReviewFeedDashboardData = ReviewsPageData & {
  feedSummary?: {
    totalReviews: number;
    newReviews: number;
    starCounts: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
    withResponse: number;
    noResponse: number;
  };
  feedDetails?: Record<string, ReviewFeedDetails>;
};

function review(
  id: string,
  overrides: Partial<ReviewListItem> & Pick<ReviewListItem, "reviewerName">
): ReviewListItem {
  return {
    id,
    reviewerName: overrides.reviewerName,
    rating: overrides.rating ?? 5,
    reviewText:
      overrides.reviewText ??
      "A-Team Junk Removal made the whole process painless. The crew arrived on time, explained pricing clearly, and had the garage cleaned out faster than expected.",
    reviewDate: overrides.reviewDate ?? "2025-06-05",
    publishedAt: overrides.publishedAt ?? "2025-06-05T15:42:00.000Z",
    firstObservedAt: overrides.firstObservedAt ?? "2025-06-05T16:00:00.000Z",
    relativeDate: overrides.relativeDate ?? "2 hours ago",
    source: overrides.source ?? "google",
    tags: overrides.tags ?? ["Positive", "Professional", "On-Time"],
    replied: overrides.replied ?? true,
    ownerResponseText:
      overrides.replied === false
        ? null
        : overrides.ownerResponseText ??
          "Thank you for choosing A-Team Junk Removal. We appreciate the kind words and look forward to serving you again!",
    isTarget: true,
    businessName: "A-Team Junk Removal",
    competitorId: null,
    daysWaiting: overrides.daysWaiting ?? null,
    urgency: overrides.urgency ?? null,
    isNew: overrides.isNew ?? true,
    resolved: overrides.resolved ?? false,
    resolvedAt: overrides.resolvedAt ?? null,
    campaignAttribution: overrides.campaignAttribution ?? null,
  };
}

const reviews: ReviewListItem[] = [
  // FIRST review must be unanswered so detail shows "No response yet"
  review("g-100284", {
    reviewerName: "Sarah Mitchell",
    rating: 5,
    tags: ["Positive", "Professionalism", "On-Time"],
    reviewText:
      "Booked in the morning and they were at my house that afternoon. The team was friendly, careful around the walls, and swept the garage before leaving. Truly five-star service.",
    publishedAt: "2025-06-08T15:42:00.000Z",
    reviewDate: "2025-06-08",
    relativeDate: "2 hours ago",
    replied: false,
    ownerResponseText: null,
    daysWaiting: 0,
    isNew: true,
  }),
  review("g-100283", {
    reviewerName: "Daniel Cho",
    rating: 4,
    tags: ["Positive", "Clear Pricing", "On-Time"],
    reviewText:
      "Good communication and fair pricing. They arrived inside the quoted window and removed an old sectional without any damage. Would recommend.",
    publishedAt: "2025-06-08T11:18:00.000Z",
    reviewDate: "2025-06-08",
    relativeDate: "6 hours ago",
    replied: true,
    ownerResponseText:
      "Thank you, Daniel! We're glad the team communicated clearly and arrived on time.",
    isNew: true,
  }),
  review("g-100282", {
    reviewerName: "Monica Alvarez",
    rating: 5,
    tags: ["Positive", "Professionalism", "Estate Cleanout"],
    reviewText:
      "We used A-Team for a difficult estate cleanout. They were respectful, hard working, and kept us updated throughout the job. Highly recommend.",
    publishedAt: "2025-06-06T19:06:00.000Z",
    reviewDate: "2025-06-06",
    relativeDate: "1 day ago",
    replied: true,
    ownerResponseText:
      "Monica, thank you for trusting us with your estate cleanout. Our team takes great care on sensitive jobs like this.",
    isNew: true,
  }),
  review("g-100281", {
    reviewerName: "Kevin Brooks",
    rating: 3,
    tags: ["Arrival Window", "Neutral", "Pricing"],
    reviewText:
      "The removal itself was fine, but the crew showed up later than expected. Pricing was clear once they arrived.",
    publishedAt: "2025-06-04T21:40:00.000Z",
    reviewDate: "2025-06-04",
    relativeDate: "3 days ago",
    replied: false,
    ownerResponseText: null,
    daysWaiting: 3,
    urgency: "medium",
    isNew: true,
  }),
  review("g-100280", {
    reviewerName: "Priya Shah",
    rating: 5,
    tags: ["Positive", "Fast Response", "Construction Debris"],
    reviewText:
      "They hauled away construction debris from a kitchen project and were much faster than the other companies I called. Great job overall.",
    publishedAt: "2025-06-02T17:24:00.000Z",
    reviewDate: "2025-06-02",
    relativeDate: "5 days ago",
    replied: true,
    ownerResponseText:
      "Priya, thank you! Construction cleanup is one of our specialties and we love exceeding expectations.",
    isNew: false,
  }),
  review("g-100279", {
    reviewerName: "Robert Miller",
    rating: 2,
    tags: ["Issue", "Follow-Up Required"],
    reviewText:
      "They missed a few items from the side yard and I had to call back. The office was helpful in the end, but it took an extra trip to resolve.",
    publishedAt: "2025-05-30T13:32:00.000Z",
    reviewDate: "2025-05-30",
    relativeDate: "8 days ago",
    replied: false,
    ownerResponseText: null,
    daysWaiting: 8,
    urgency: "high",
    isNew: false,
  }),
  review("g-100278", {
    reviewerName: "Emily Watson",
    rating: 5,
    tags: ["Positive", "Professionalism", "Appliance Removal"],
    reviewText:
      "Great experience removing a refrigerator and washer. They protected the floors and were very professional throughout.",
    publishedAt: "2025-05-25T14:12:00.000Z",
    reviewDate: "2025-05-25",
    relativeDate: "13 days ago",
    replied: true,
    ownerResponseText:
      "Emily, we're so glad the appliance removal went smoothly! Thank you for the kind review.",
    isNew: false,
  }),
  review("g-100277", {
    reviewerName: "Marcus Lee",
    rating: 4,
    tags: ["Positive", "Friendly Staff", "Scheduling"],
    reviewText:
      "Friendly staff and easy scheduling for yard debris pickup. I would use them again without hesitation.",
    publishedAt: "2025-05-18T10:05:00.000Z",
    reviewDate: "2025-05-18",
    relativeDate: "20 days ago",
    replied: true,
    ownerResponseText:
      "Marcus, thank you for the kind words! We look forward to your next booking.",
    isNew: false,
  }),
];

export const reviewFeedPreviewData: ReviewFeedDashboardData = {
  businessId: REVIEW_FEED_PREVIEW_BUSINESS_ID,
  businessName: "A-Team Junk Removal",
  hasData: true,
  lastSyncedAt: "2025-06-08T17:10:00.000Z",
  feedSummary: {
    totalReviews: 327,
    newReviews: 18,
    starCounts: {
      5: 214,
      4: 65,
      3: 28,
      2: 13,
      1: 7,
    },
    withResponse: 269,
    noResponse: 58,
  },
  feedDetails: {
    "g-100284": {
      reviewId: "google:ChZDSUhNMG9nS0VJQ0FnSUR6aWVmR0l3",
      publishedDateTime: "2025-06-08T15:42:00.000Z",
      location: "A-Team Junk Removal – Raleigh",
      lastEditedAt: null,
      sentiment: { label: "Positive", confidence: 0.97 },
    },
    "g-100283": {
      reviewId: "google:ChdDSUhNMG9nS0VJQ0FnSUR6eHUtWjFBRR",
      publishedDateTime: "2025-06-08T11:18:00.000Z",
      location: "A-Team Junk Removal – Raleigh",
      lastEditedAt: "2025-06-08T12:04:00.000Z",
      edited: true,
      sentiment: { label: "Positive", confidence: 0.82 },
    },
    "g-100282": {
      reviewId: "google:ChRDSUhNMG9nS0VJQ0FnSUR6eDV1aRAB",
      publishedDateTime: "2025-06-06T19:06:00.000Z",
      location: "A-Team Junk Removal – Cary",
      lastEditedAt: null,
      sentiment: { label: "Positive", confidence: 0.96 },
    },
    "g-100281": {
      reviewId: "google:ChNDSUhNMG9nS0VJQ0FnSUR6a0t6MRAB",
      publishedDateTime: "2025-06-04T21:40:00.000Z",
      location: "A-Team Junk Removal – Raleigh",
      lastEditedAt: null,
      sentiment: { label: "Neutral", confidence: 0.77 },
    },
    "g-100280": {
      reviewId: "google:ChJDSUhNMG9nS0VJQ0FnSUR6X1FmY0l3",
      publishedDateTime: "2025-06-02T17:24:00.000Z",
      location: "A-Team Junk Removal – Durham",
      lastEditedAt: null,
      sentiment: { label: "Positive", confidence: 0.94 },
    },
    "g-100279": {
      reviewId: "google:ChVDSUhNMG9nS0VJQ0FnSUR6b3RtR0NR",
      publishedDateTime: "2025-05-30T13:32:00.000Z",
      location: "A-Team Junk Removal – Raleigh",
      lastEditedAt: "2025-05-30T14:11:00.000Z",
      edited: true,
      sentiment: { label: "Negative", confidence: 0.89 },
    },
  },
  kpis: {
    avgRating: 4.6,
    avgRatingDelta: 0.1,
    totalReviews: 327,
    newReviews90d: 71,
    newReviews90dDelta: 8,
    reviewGap: 48,
    responseRate: 82,
    responseRateDelta: 4,
    unanswered90d: 58,
    avgDaysWaiting: 1.4,
    urgentCount: 7,
  },
  latestTargetReviews: reviews.slice(0, 3),
  competitorActivity: [],
  topKeywords: [
    { keyword: "same-day service", count: 42 },
    { keyword: "professional crew", count: 38 },
    { keyword: "fair pricing", count: 31 },
  ],
  competitorWinningKeywords: [],
  fastestGrowingCompetitor: null,
  stream: reviews,
  yourReviews: reviews,
  competitors: [],
  competitorReviews: [],
  keywordGaps: [],
  trendingKeywords: [],
  positivePct: 84,
  negativePct: 7,
  themeMovement: [],
  sentiment: {
    yours: {
      sentiment: {
        positive: 275,
        negative: 23,
        neutral: 29,
        total: 327,
        positivePct: 84,
        negativePct: 7,
        neutralPct: 9,
      },
      themes: [
        { themeId: "speed_scheduling", label: "Same-day service", reviewCount: 42, pct: 13 },
        { themeId: "professionalism", label: "Professional crew", reviewCount: 38, pct: 12 },
        { themeId: "pricing_value", label: "Fair pricing", reviewCount: 31, pct: 9 },
      ],
    },
    competitors: [],
    entities: [],
    marketSentiment: {
      positive: 0,
      negative: 0,
      neutral: 0,
      total: 0,
      positivePct: 0,
      negativePct: 0,
      neutralPct: 0,
    },
    themeComparison: [],
    themeMovement: [],
    entityMovement: [],
    insights: [],
  },
  unanswered: reviews.filter((row) => !row.replied),
  suggestions: [
    {
      id: "reply-no-response",
      title: "Reply to 58 unanswered reviews",
      description: "Prioritize the newest low-rating reviews first.",
      type: "reply",
    },
  ],
  syncState: { needsRun: false, message: null },
};
