import type { ReviewAnalyticsData } from "@/lib/reviews/review-analytics-data";

export const REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID = "preview-review-analytics";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Start Mar 10, 2025 → 90 days → ends Jun 7, 2025 (inclusive of Jun 8)
const start = new Date("2025-03-10T12:00:00.000Z");

const timelinePoints = Array.from({ length: 90 }, (_, index) => {
  const date = ymd(addDays(start, index));
  // Gradually increasing volume towards end to reflect accelerating momentum
  const baseWave = index % 9;
  const accelerationFactor = 1 + index / 120;
  const you = Math.round(([0, 1, 0, 1, 0, 2, 1, 0, 1][baseWave] ?? 0) * accelerationFactor);
  const top = [1, 0, 1, 1, 0, 1, 1, 2, 0][baseWave] ?? 0;
  const second = [0, 1, 0, 0, 1, 0, 1, 0, 1][baseWave] ?? 0;
  const events: Array<{ id: string; date: string; type: "campaign_start" | "maps_scan"; label: string }> = [];

  // Campaign Started (around April 14, 2025, index 35)
  if (index === 35) {
    events.push({
      id: "campaign-spring-2025",
      date,
      type: "campaign_start" as const,
      label: "Campaign Started",
    });
  }
  // SMS Campaign Sent (around May 4, 2025, index 55)
  if (index === 55) {
    events.push({
      id: "sms-campaign-may-2025",
      date,
      type: "campaign_start" as const,
      label: "SMS Campaign Sent",
    });
  }
  // Maps Scan (around May 24, 2025, index 75)
  if (index === 75) {
    events.push({
      id: "maps-scan-may-2025",
      date,
      type: "maps_scan" as const,
      label: "Maps Scan",
    });
  }
  return {
    date,
    you,
    competitorAvg: Math.round(((top + second) / 2) * 10) / 10,
    competitorSeries: {
      "top-competitor": top,
      "2nd-competitor": second,
    },
    events,
  };
});

export const reviewAnalyticsPreviewData: ReviewAnalyticsData & Record<string, unknown> = {
  businessId: REVIEW_ANALYTICS_PREVIEW_BUSINESS_ID,
  businessName: "A-Team Junk Removal",
  timezone: "America/New_York",
  lastSyncedAt: "2025-06-08T17:10:00.000Z",
  groupModes: ["daily", "weekly", "monthly"],
  totalReviews: 327,
  avgRating: 4.6,
  avgRatingDelta: 0.1,
  responseRateDelta: 4,
  ratingDistribution: { 1: 4, 2: 7, 3: 18, 4: 96, 5: 202 },
  sources: [
    {
      id: "google",
      name: "Google",
      provider: "google",
      rating: 4.6,
      reviews: 327,
      last30d: 24,
      last60d: 42,
      last90d: 71,
      total: 327,
      prior30d: 15,
    },
  ],
  recentReviews: [
    {
      id: "preview-review-1",
      reviewerName: "Maya Thompson",
      rating: 5,
      text: "Fast pickup, friendly crew, and clear communication from booking through cleanup.",
      date: "2025-06-07T14:30:00.000Z",
      businessName: "A-Team Junk Removal",
      competitorId: null,
      isYou: true,
    },
    {
      id: "preview-review-2",
      reviewerName: "Chris Walker",
      rating: 5,
      text: "They arrived on time and removed everything without damaging the driveway.",
      date: "2025-06-05T18:10:00.000Z",
      businessName: "A-Team Junk Removal",
      competitorId: null,
      isYou: true,
    },
    {
      id: "preview-review-3",
      reviewerName: "Priya S.",
      rating: 4,
      text: "Good experience overall. The team was professional and the price was fair.",
      date: "2025-06-03T12:20:00.000Z",
      businessName: "A-Team Junk Removal",
      competitorId: null,
      isYou: true,
    },
    {
      id: "preview-comp-1",
      reviewerName: "Alex R.",
      rating: 5,
      text: "Top competitor showed up same day and finished fast.",
      date: "2025-06-06T10:00:00.000Z",
      businessName: "Top Competitor Co",
      competitorId: "top-competitor",
      isYou: false,
    },
    {
      id: "preview-comp-2",
      reviewerName: "Jamie L.",
      rating: 4,
      text: "Solid crew from the second competitor. Scheduling took a day.",
      date: "2025-06-04T15:00:00.000Z",
      businessName: "2nd Competitor Co",
      competitorId: "2nd-competitor",
      isYou: false,
    },
  ],
  tasks: [
    {
      id: "task-reply",
      title: "Reply to four new reviews",
      description: "Recent 4-5 star reviews are waiting for owner responses.",
      priority: "High",
      status: "open",
    },
    {
      id: "task-requests",
      title: "Send requests after completed jobs",
      description: "Keep the weekly review target on pace with an automated request batch.",
      priority: "Medium",
      status: "open",
    },
  ],
  competitors: [
    {
      id: "top-competitor",
      name: "Top Competitor",
      rating: 4.5,
      totalReviews: 375,
      rolling7d: 7,
      rolling30d: 19,
      rolling60d: 36,
      rolling90d: 64,
      prior30d: 16,
    },
    {
      id: "2nd-competitor",
      name: "2nd Competitor",
      rating: 4.4,
      totalReviews: 298,
      rolling7d: 5,
      rolling30d: 18,
      rolling60d: 31,
      rolling90d: 52,
      prior30d: 20,
    },
  ],
  timelinePoints,
  timelineByCompetitor: {
    "top-competitor": timelinePoints.map((point) => point.competitorSeries?.["top-competitor"] ?? 0),
    "2nd-competitor": timelinePoints.map((point) => point.competitorSeries?.["2nd-competitor"] ?? 0),
  },
  timelineEvents: timelinePoints.flatMap((point) => point.events),
  // weeklyVelocity and monthlyVelocity are avg rates over the period
  weeklyVelocity: 2.8,
  monthlyVelocity: 12.1,
  rolling7d: 9,
  rolling30d: 24,
  rolling60d: 42,
  rolling90d: 71,
  rollingPeriods: [
    // 7d: 9 ▲50%  → prev=6, delta=3
    { days: 7, current: 9, previous: 6, delta: 3, deltaPct: 50 },
    // 30d: 24 ▲60% → prev=15, delta=9
    { days: 30, current: 24, previous: 15, delta: 9, deltaPct: 60 },
    // 60d: 42 ▲75% → prev=24, delta=18
    { days: 60, current: 42, previous: 24, delta: 18, deltaPct: 75 },
    // 90d: 71 ▲91% → prev=37, delta=34
    { days: 90, current: 71, previous: 37, delta: 34, deltaPct: 91 },
  ],
  priorPeriod: {
    rolling7d: 6,
    rolling30d: 15,
    rolling60d: 24,
    rolling90d: 37,
    rolling7dDelta: 3,
    rolling30dDelta: 9,
    rolling60dDelta: 18,
    rolling90dDelta: 34,
    // weeklyVelocity 2.8 ▲75% → prev=1.6, delta=1.2
    weeklyVelocityDelta: 1.2,
    // monthlyVelocity 12.1 ▲60% → prev=7.6, delta=4.5
    monthlyVelocityDelta: 4.5,
  },
  responseRate: 82,
  avgResponseTimeDays: 1.8,
  avgDaysBetweenReviews: 1.4,
  medianDaysBetweenReviews: 1.3,
  longestDroughtDays: 5,
  // 8 consecutive weeks = 56 days
  activeStreakDays: 56,
  accelerationPct: 60,
  momentumStatus: "Accelerating",
  momentumLabel: "Accelerating",
  drivers: [
    "30-day reviews up 9 vs prior period (60% increase)",
    "7-day reviews up 3 vs prior week (50% increase)",
    "Review requests launched before the last velocity spike",
    "You're ahead of competitor average over the last 30 days (24 vs 19)",
  ],
  explanation: "Momentum is accelerating: 30-day volume is up 60% and all rolling windows are growing.",
  competitorRelative: "You're slightly ahead of the competitor average over the last 30 days (24 vs 19).",
  dateRangeLabel: "May 10 – Jun 8, 2025",
  momentumScore: 82,
  momentumFactors: [
    { label: "Recent Velocity", strength: "Very Strong" },
    { label: "Velocity Change", strength: "Strong" },
    { label: "Consistency", strength: "Strong" },
    { label: "Recency", strength: "Very Strong" },
    { label: "Competitor Compare", strength: "Strong" },
  ],
  avgDaysBetweenDelta: -0.3,
  periodRows: [
    { label: "Last 7 days", reviews: 9, previous: 6, delta: 3, deltaPct: 50 },
    { label: "Last 30 days", reviews: 24, previous: 15, delta: 9, deltaPct: 60 },
    { label: "Last 60 days", reviews: 42, previous: 24, delta: 18, deltaPct: 75 },
    { label: "Last 90 days", reviews: 71, previous: 37, delta: 34, deltaPct: 91 },
    { label: "Last 12 months", reviews: 280, previous: 241, delta: 39, deltaPct: 16 },
  ],
};
