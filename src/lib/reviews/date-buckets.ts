import { startOfDay, subDays, differenceInCalendarDays, format } from "date-fns";
import type { NormalizedReview } from "@/lib/reviews/normalize";

export type TrendWindow90d = "exact_7d" | "weekly_8_30" | "month_2" | "month_3" | "older";

export interface ReviewAgeBucket {
  in7dExact: boolean;
  in30d: boolean;
  in90d: boolean;
  /** 0 = today … 6 = six days ago (exact daily bucket) */
  exactDayOffset: number | null;
  /** Week bucket within days 8–30 (1–4), not placed on exact calendar days */
  weekIn30d: 1 | 2 | 3 | 4 | null;
  window90d: TrendWindow90d;
}

function normalizeRelative(text: string): string {
  return text.trim().replace(/^edited\s+/i, "").trim().toLowerCase();
}

function parseRelativeDaysAgo(relative: string): number | null {
  const t = normalizeRelative(relative);
  if (t === "today") return 0;
  if (t === "yesterday") return 1;
  const dayM = t.match(/^(\d+)\s+days?\s+ago/);
  if (dayM) return Number(dayM[1]);
  const dayM2 = t.match(/^(\d+)\s+day/);
  if (dayM2) return Number(dayM2[1]);
  if (/^a\s+day/.test(t)) return 1;
  return null;
}

function parseRelativeWeeksAgo(relative: string): number | null {
  const t = normalizeRelative(relative);
  const m = t.match(/^(\d+)\s+weeks?\s+ago/);
  if (m) return Number(m[1]);
  if (/^a\s+week/.test(t)) return 1;
  return null;
}

function parseRelativeMonthsAgo(relative: string): number | null {
  const t = normalizeRelative(relative);
  const m = t.match(/^(\d+)\s+months?\s+ago/);
  if (m) return Number(m[1]);
  if (/^a\s+month/.test(t)) return 1;
  return null;
}

/** Classify using Google relative text (preferred for 30d boundary). */
export function classifyFromRelative(relative: string): ReviewAgeBucket | null {
  const months = parseRelativeMonthsAgo(relative);
  if (months != null) {
    if (months === 1) {
      return {
        in7dExact: false,
        in30d: false,
        in90d: true,
        exactDayOffset: null,
        weekIn30d: null,
        window90d: "month_2",
      };
    }
    if (months === 2) {
      return {
        in7dExact: false,
        in30d: false,
        in90d: true,
        exactDayOffset: null,
        weekIn30d: null,
        window90d: "month_3",
      };
    }
    if (months === 3) {
      return {
        in7dExact: false,
        in30d: false,
        in90d: true,
        exactDayOffset: null,
        weekIn30d: null,
        window90d: "month_3",
      };
    }
    return {
      in7dExact: false,
      in30d: false,
      in90d: false,
      exactDayOffset: null,
      weekIn30d: null,
      window90d: "older",
    };
  }

  const weeks = parseRelativeWeeksAgo(relative);
  if (weeks != null && weeks >= 1 && weeks <= 4) {
    return {
      in7dExact: false,
      in30d: true,
      in90d: true,
      exactDayOffset: null,
      weekIn30d: weeks as 1 | 2 | 3 | 4,
      window90d: "weekly_8_30",
    };
  }

  const days = parseRelativeDaysAgo(relative);
  if (days != null) {
    if (days <= 6) {
      return {
        in7dExact: true,
        in30d: true,
        in90d: true,
        exactDayOffset: days,
        weekIn30d: null,
        window90d: "exact_7d",
      };
    }
    if (days === 7) {
      return {
        in7dExact: false,
        in30d: true,
        in90d: true,
        exactDayOffset: null,
        weekIn30d: 1,
        window90d: "weekly_8_30",
      };
    }
  }

  return null;
}

function classifyFromIso(reviewDate: Date, now = new Date()): ReviewAgeBucket {
  const daysAgo = differenceInCalendarDays(startOfDay(now), startOfDay(reviewDate));

  if (daysAgo <= 6) {
    return {
      in7dExact: true,
      in30d: true,
      in90d: true,
      exactDayOffset: daysAgo,
      weekIn30d: null,
      window90d: "exact_7d",
    };
  }
  if (daysAgo <= 30) {
    const weekIn30d = Math.min(4, Math.max(1, Math.ceil((daysAgo - 6) / 7))) as 1 | 2 | 3 | 4;
    return {
      in7dExact: false,
      in30d: true,
      in90d: true,
      exactDayOffset: null,
      weekIn30d,
      window90d: "weekly_8_30",
    };
  }
  if (daysAgo <= 60) {
    return {
      in7dExact: false,
      in30d: false,
      in90d: true,
      exactDayOffset: null,
      weekIn30d: null,
      window90d: "month_2",
    };
  }
  if (daysAgo <= 90) {
    return {
      in7dExact: false,
      in30d: false,
      in90d: true,
      exactDayOffset: null,
      weekIn30d: null,
      window90d: "month_3",
    };
  }
  return {
    in7dExact: false,
    in30d: false,
    in90d: false,
    exactDayOffset: null,
    weekIn30d: null,
    window90d: "older",
  };
}

/** Classify a review for momentum bucketing. iso_date drives placement; relative enforces 30d month cutoff. */
export function classifyReviewAge(review: NormalizedReview, now = new Date()): ReviewAgeBucket | null {
  const relative = review.relativeDateText;
  if (relative) {
    const months = parseRelativeMonthsAgo(relative);
    if (months != null && months >= 1) {
      if (months === 1) {
        return {
          in7dExact: false,
          in30d: false,
          in90d: true,
          exactDayOffset: null,
          weekIn30d: null,
          window90d: "month_2",
        };
      }
      if (months === 2) {
        return {
          in7dExact: false,
          in30d: false,
          in90d: true,
          exactDayOffset: null,
          weekIn30d: null,
          window90d: "month_3",
        };
      }
      if (months === 3) {
        return {
          in7dExact: false,
          in30d: false,
          in90d: true,
          exactDayOffset: null,
          weekIn30d: null,
          window90d: "month_3",
        };
      }
      return {
        in7dExact: false,
        in30d: false,
        in90d: false,
        exactDayOffset: null,
        weekIn30d: null,
        window90d: "older",
      };
    }
  }

  if (review.reviewDate) return classifyFromIso(review.reviewDate, now);
  if (relative) return classifyFromRelative(relative);
  return null;
}

export interface BucketedCounts {
  reviews7d: number;
  reviews30d: number;
  reviews90d: number;
  dailyExact7d: Array<{ date: string; count: number; exact: true }>;
  weeklyBuckets8to30: Array<{ label: string; count: number; bucketed: true }>;
  trendBuckets90d: Array<{ label: string; count: number; bucketed: boolean }>;
}

export function aggregateBucketedCounts(reviews: NormalizedReview[], now = new Date()): BucketedCounts {
  const dailyExact7d = Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i;
    const d = subDays(startOfDay(now), daysAgo);
    return {
      date: daysAgo === 0 ? "Today" : format(d, "MMM d"),
      count: 0,
      exact: true as const,
    };
  });

  const weeklyBuckets8to30 = [
    { label: "Week 1 (8–14d)", count: 0, bucketed: true as const },
    { label: "Week 2 (15–21d)", count: 0, bucketed: true as const },
    { label: "Week 3 (22–28d)", count: 0, bucketed: true as const },
    { label: "Week 4 (29–30d)", count: 0, bucketed: true as const },
  ];

  const trendBuckets90d = [
    { label: "0–7 days", count: 0, bucketed: false },
    { label: "8–30 days", count: 0, bucketed: true },
    { label: "31–60 days", count: 0, bucketed: true },
    { label: "61–90 days", count: 0, bucketed: true },
  ];

  let reviews7d = 0;
  let reviews30d = 0;
  let reviews90d = 0;

  const sorted = [...reviews].sort((a, b) => {
    const aRel = a.relativeDateText ?? "";
    const bRel = b.relativeDateText ?? "";
    if (aRel && bRel) return 0;
    const aT = a.reviewDate?.getTime() ?? 0;
    const bT = b.reviewDate?.getTime() ?? 0;
    return bT - aT;
  });

  for (const review of sorted) {
    const bucket = classifyReviewAge(review, now);
    if (!bucket) continue;

    if (bucket.in7dExact) reviews7d++;
    if (bucket.in30d) reviews30d++;
    if (bucket.in90d) reviews90d++;

    if (bucket.exactDayOffset != null && bucket.exactDayOffset <= 6) {
      const idx = 6 - bucket.exactDayOffset;
      if (idx >= 0 && idx < 7) dailyExact7d[idx].count++;
    }

    if (bucket.weekIn30d != null) {
      weeklyBuckets8to30[bucket.weekIn30d - 1].count++;
    }

    switch (bucket.window90d) {
      case "exact_7d":
        trendBuckets90d[0].count++;
        break;
      case "weekly_8_30":
        trendBuckets90d[1].count++;
        break;
      case "month_2":
        trendBuckets90d[2].count++;
        break;
      case "month_3":
        trendBuckets90d[3].count++;
        break;
      default:
        break;
    }
  }

  return {
    reviews7d,
    reviews30d,
    reviews90d,
    dailyExact7d,
    weeklyBuckets8to30,
    trendBuckets90d,
  };
}

/** 30-day count by walking newest-first until "1 month ago" (relative stream rule). */
export function count30dRelativeStream(reviews: NormalizedReview[]): number {
  const sorted = [...reviews].sort((a, b) => {
    const aT = a.reviewDate?.getTime() ?? 0;
    const bT = b.reviewDate?.getTime() ?? 0;
    return bT - aT;
  });

  let count = 0;
  for (const review of sorted) {
    const rel = review.relativeDateText;
    if (rel) {
      const months = parseRelativeMonthsAgo(rel);
      if (months != null && months >= 1) break;
      const weeks = parseRelativeWeeksAgo(rel);
      if (weeks != null && weeks >= 1 && weeks <= 4) {
        count++;
        continue;
      }
      const days = parseRelativeDaysAgo(rel);
      if (days != null && days <= 6) {
        count++;
        continue;
      }
      if (days === 7 || weeks != null) {
        count++;
        continue;
      }
    }
    const bucket = classifyReviewAge(review);
    if (bucket?.in30d) count++;
    else if (bucket && !bucket.in30d) break;
  }
  return count;
}
