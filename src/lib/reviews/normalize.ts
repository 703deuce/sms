import {
  subDays,
  startOfDay,
  differenceInCalendarDays,
  format,
  parseISO,
  isValid,
} from "date-fns";

function coerceOwnerResponseText(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.text === "string") return coerceOwnerResponseText(o.text);
    if (typeof o.snippet === "string") return coerceOwnerResponseText(o.snippet);
  }
  return null;
}

export function hasOwnerResponse(text: string | null | undefined): boolean {
  return Boolean(text?.trim());
}

export interface NormalizedReview {
  sourceReviewId: string | null;
  reviewerName: string | null;
  rating: number | null;
  reviewText: string | null;
  reviewDate: Date | null;
  /** Authoritative publish timestamp when iso_date (or equivalent) was available. */
  publishedAt: Date | null;
  lastEditedAt: Date | null;
  datePrecision: "exact" | "estimated" | "unknown";
  relativeDateText: string | null;
  ownerResponseText: string | null;
  ownerRespondedAt: Date | null;
  reviewUrl: string | null;
  raw: Record<string, unknown>;
  dateParseWarning?: boolean;
}

const RELATIVE_PATTERNS: Array<{ re: RegExp; multiplier: number }> = [
  { re: /^(\d+)\s+minute/i, multiplier: 0 },
  { re: /^(\d+)\s+hour/i, multiplier: 0 },
  { re: /^(\d+)\s+day/i, multiplier: 1 },
  { re: /^(\d+)\s+week/i, multiplier: 7 },
  { re: /^(\d+)\s+month/i, multiplier: 30 },
  { re: /^(\d+)\s+year/i, multiplier: 365 },
  { re: /^a\s+day/i, multiplier: 1 },
  { re: /^a\s+week/i, multiplier: 7 },
  { re: /^a\s+month/i, multiplier: 30 },
  { re: /^a\s+year/i, multiplier: 365 },
  { re: /^an?\s+hour/i, multiplier: 0 },
];

function parseRelativeDate(text: string, now = new Date()): Date | null {
  const trimmed = text.trim().replace(/^edited\s+/i, "").trim();
  for (const { re, multiplier } of RELATIVE_PATTERNS) {
    const m = trimmed.match(re);
    if (m) {
      const n = m[1] ? Number(m[1]) : 1;
      return startOfDay(subDays(now, n * multiplier));
    }
  }
  if (/^\d+\s+days?\s+ago/i.test(trimmed)) {
    const n = Number(trimmed.match(/(\d+)/)?.[1] ?? 0);
    return startOfDay(subDays(now, n));
  }
  if (/^yesterday/i.test(trimmed)) {
    return startOfDay(subDays(now, 1));
  }
  if (/^today/i.test(trimmed)) {
    return startOfDay(now);
  }
  return null;
}

function parseReviewDate(raw: Record<string, unknown>): {
  date: Date | null;
  relative: string | null;
  warning: boolean;
  precision: "exact" | "estimated" | "unknown";
  lastEditedAt: Date | null;
} {
  const relative =
    (raw.relative_date as string) ??
    (raw.relative_time as string) ??
    (typeof raw.date === "string" && raw.date.match(/ago|week|month|day|year|hour|minute/i) ? raw.date : null) ??
    null;

  let lastEditedAt: Date | null = null;
  if (typeof raw.iso_date_of_last_edit === "string") {
    const edited = parseISO(raw.iso_date_of_last_edit);
    if (isValid(edited)) lastEditedAt = edited;
  }

  // Exact timestamps keep full UTC precision — never collapse to startOfDay.
  if (typeof raw.time === "number" && raw.time > 0) {
    return {
      date: new Date(raw.time * 1000),
      relative,
      warning: false,
      precision: "exact",
      lastEditedAt,
    };
  }

  if (typeof raw.timestamp === "number" && raw.timestamp > 0) {
    const ts = raw.timestamp > 1e12 ? raw.timestamp : raw.timestamp * 1000;
    return {
      date: new Date(ts),
      relative,
      warning: false,
      precision: "exact",
      lastEditedAt,
    };
  }

  if (typeof raw.iso_date === "string") {
    const d = parseISO(raw.iso_date);
    if (isValid(d)) {
      return { date: d, relative, warning: false, precision: "exact", lastEditedAt };
    }
  }

  if (lastEditedAt) {
    return {
      date: lastEditedAt,
      relative,
      warning: false,
      precision: "exact",
      lastEditedAt,
    };
  }

  if (typeof raw.review_datetime === "string") {
    const d = parseISO(raw.review_datetime);
    if (isValid(d)) {
      return { date: d, relative, warning: false, precision: "exact", lastEditedAt };
    }
  }

  if (typeof raw.date === "string" && !raw.date.match(/ago|week|month|day|year|hour|minute/i)) {
    const d = parseISO(raw.date);
    if (isValid(d)) {
      // Date-only strings (YYYY-MM-DD) parse as UTC midnight — still mark exact when ISO-valid.
      return { date: d, relative, warning: false, precision: "exact", lastEditedAt };
    }
  }

  if (relative) {
    const parsed = parseRelativeDate(relative);
    if (parsed) {
      return { date: parsed, relative, warning: true, precision: "estimated", lastEditedAt };
    }
  }

  return { date: null, relative, warning: !!relative, precision: "unknown", lastEditedAt };
}

export function normalizeScrapingDogReview(raw: unknown): NormalizedReview {
  const r = (raw ?? {}) as Record<string, unknown>;
  const { date, relative, warning, precision, lastEditedAt } = parseReviewDate({
    ...r,
    iso_date: r.iso_date,
    iso_date_of_last_edit: r.iso_date_of_last_edit,
    time: r.time,
    date: r.date,
    relative_date: r.relative_date ?? r.relative_time,
  });
  const ownerResponseText =
    coerceOwnerResponseText(r.owner_response) ??
    coerceOwnerResponseText((r.owner_response as { text?: string })?.text) ??
    coerceOwnerResponseText(r.response);
  let ownerRespondedAt: Date | null = null;
  const ownerObj = r.owner_response as { date?: string; iso_date?: string } | string | undefined;
  if (ownerObj && typeof ownerObj === "object") {
    const od = ownerObj.iso_date ?? ownerObj.date;
    if (typeof od === "string") {
      const parsed = parseISO(od);
      if (isValid(parsed)) ownerRespondedAt = parsed;
    }
  }
  return {
    sourceReviewId:
      (r.review_id as string) ??
      (r.id as string) ??
      (r.user as { id?: string })?.id ??
      null,
    reviewerName:
      (r.username as string) ??
      (r.user as { name?: string })?.name ??
      (r.author as string) ??
      null,
    rating: r.rating != null ? Number(r.rating) : null,
    reviewText: (r.snippet as string) ?? (r.text as string) ?? (r.description as string) ?? null,
    reviewDate: date,
    publishedAt: precision === "exact" && date ? date : date,
    lastEditedAt,
    datePrecision: precision,
    relativeDateText: relative,
    ownerResponseText,
    ownerRespondedAt,
    reviewUrl: (r.link as string) ?? (r.review_url as string) ?? null,
    raw: r,
    dateParseWarning: warning,
  };
}

export function normalizeDataForSeoReview(raw: unknown): NormalizedReview {
  const r = (raw ?? {}) as Record<string, unknown>;
  const profile = (r.profile_name as string) ?? (r.user_profile as { name?: string })?.name ?? null;
  const ratingVal =
    r.rating != null && typeof r.rating === "object"
      ? Number((r.rating as { value?: number }).value)
      : r.rating != null
        ? Number(r.rating)
        : null;
  const { date, relative, warning, precision, lastEditedAt } = parseReviewDate({
    ...r,
    iso_date: r.timestamp ?? r.datetime,
  });
  return {
    sourceReviewId: (r.review_id as string) ?? (r.id as string) ?? null,
    reviewerName: profile,
    rating: ratingVal,
    reviewText: (r.review_text as string) ?? (r.text as string) ?? null,
    reviewDate: date,
    publishedAt: date,
    lastEditedAt,
    datePrecision: precision,
    relativeDateText: relative ?? (r.time_ago as string) ?? null,
    ownerResponseText: coerceOwnerResponseText(r.owner_answer) ?? coerceOwnerResponseText(r.owner_response),
    ownerRespondedAt: null,
    reviewUrl: (r.url as string) ?? null,
    raw: r,
    dateParseWarning: warning,
  };
}

export function dedupeKey(review: NormalizedReview, entityKey: string): string {
  if (review.sourceReviewId) return `${entityKey}:${review.sourceReviewId}`;
  const textHash = (review.reviewText ?? "").slice(0, 80);
  return `${entityKey}:${review.reviewerName ?? "?"}:${review.rating ?? "?"}:${review.reviewDate?.toISOString() ?? review.relativeDateText ?? textHash}`;
}

export function formatDateLabel(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function daysSince(date: Date | null, now = new Date()): number | null {
  if (!date) return null;
  return differenceInCalendarDays(startOfDay(now), startOfDay(date));
}
