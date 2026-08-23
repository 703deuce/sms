import type { NormalizedReview } from "@/lib/reviews/normalize";
import { hasOwnerResponse } from "@/lib/reviews/normalize";

export type ResponseQualitySummary = {
  personalizedPct: number;
  genericPct: number;
  copyPastePct: number;
  defensiveCount: number;
  addressesIssuePct: number;
  offersResolutionPct: number;
};

export type ResponseQualityRow = {
  reviewId?: string;
  personalized: boolean;
  generic: boolean;
  copyPasteClusterId: string | null;
  defensive: boolean;
  addressesIssue: boolean;
  offersResolution: boolean;
  evidence: string[];
};

export type ResponseAudit = {
  responseRate: number;
  totalWithText: number;
  answered: number;
  unansweredPositive: number;
  unansweredNegative: number;
  unansweredNeutral: number;
  genericResponseSuspected: number;
  avgResponseTimeDays?: number | null;
  qualitySummary: ResponseQualitySummary;
  responseQualityRows: ResponseQualityRow[];
};

function sentimentFromRating(rating: number | null): "positive" | "negative" | "neutral" {
  if (rating == null) return "neutral";
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

function isGenericResponse(text: string): boolean {
  const t = text.toLowerCase().trim();
  const wordCount = tokenize(t).length;
  const generic = [
    "thank you for your review",
    "thank you for the review",
    "thanks for the review",
    "thanks for your feedback",
    "we appreciate your business",
    "we appreciate your feedback",
    "thank you for choosing",
    "thank you",
    "thanks",
  ];
  const hasCannedPhrase = generic.some((g) => t.includes(g));
  return hasCannedPhrase && (t.length < 140 || wordCount <= 24);
}

const DEFENSIVE_PHRASES = [
  "not our fault",
  "you should have",
  "as we explained",
  "unfortunately we cannot",
  "unfortunately we can't",
  "we cannot",
  "we can't",
  "you failed to",
  "we told you",
  "per our policy",
];

const RESOLUTION_PHRASES = [
  "refund",
  "make it right",
  "discount",
  "come back",
  "call me",
  "call us",
  "resolve",
  "resolved",
  "resolution",
  "credit",
  "reach out",
  "contact us",
];

const SERVICE_TERMS = [
  "appointment",
  "arrival",
  "billing",
  "call",
  "clean",
  "cleanup",
  "communication",
  "crew",
  "damage",
  "delivery",
  "estimate",
  "install",
  "job",
  "late",
  "manager",
  "price",
  "pricing",
  "project",
  "quote",
  "refund",
  "repair",
  "schedule",
  "service",
  "staff",
  "technician",
  "team",
  "work",
];

const NEGATIVE_COMPLAINT_TERMS = [
  "bad",
  "broken",
  "damage",
  "damaged",
  "dirty",
  "disappointed",
  "expensive",
  "late",
  "missed",
  "never",
  "no show",
  "overcharge",
  "overcharged",
  "poor",
  "problem",
  "rude",
  "slow",
  "terrible",
  "unprofessional",
  "waiting",
  "wrong",
];

const TOKEN_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "being",
  "business",
  "could",
  "from",
  "have",
  "just",
  "more",
  "really",
  "review",
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

type AuditableReview = {
  id?: string;
  reviewerName?: string | null;
  rating: number | null;
  reviewText: string | null;
  ownerResponseText: string | null;
  publishedAt?: Date | null;
  ownerRespondedAt?: Date | null;
};

export type StoredResponseAuditRow = {
  id?: string;
  rating: number | null;
  review_text: string | null;
  owner_response_text: string | null;
  published_at?: string | null;
  owner_responded_at?: string | null;
  reviewer_name?: string | null;
};

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function tokenize(text: string | null | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .match(/[a-z][a-z']{2,}/g)
    ?.filter((token) => !TOKEN_STOP_WORDS.has(token)) ?? [];
}

function normalizeResponse(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "<phone>")
    .replace(/[^a-z0-9\s<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clusterKey(text: string): string {
  const normalized = normalizeResponse(text);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length <= 18) return normalized;
  return tokens.slice(0, 18).join(" ");
}

function firstName(name: string | null | undefined): string | null {
  const token = name?.trim().split(/\s+/)[0]?.replace(/[^A-Za-z'-]/g, "");
  return token && token.length > 1 ? token.toLowerCase() : null;
}

function containsAny(text: string, phrases: string[]): string | null {
  const lower = text.toLowerCase();
  return phrases.find((phrase) => lower.includes(phrase)) ?? null;
}

function sharedSpecificTokens(reviewText: string | null, responseText: string): string[] {
  const responseTokens = new Set(tokenize(responseText));
  const reviewTokens = Array.from(new Set(tokenize(reviewText)));
  return reviewTokens.filter((token) => responseTokens.has(token) && token.length >= 4);
}

function complaintTokens(reviewText: string | null): string[] {
  const lower = (reviewText ?? "").toLowerCase();
  const phraseHits = NEGATIVE_COMPLAINT_TERMS.filter((term) => lower.includes(term));
  const tokenHits = tokenize(reviewText).filter((token) =>
    NEGATIVE_COMPLAINT_TERMS.some((term) => term.includes(" ") ? false : token.includes(term))
  );
  return Array.from(new Set([...phraseHits, ...tokenHits]));
}

function analyzeResponseQuality(review: AuditableReview, copyPasteClusterId: string | null): ResponseQualityRow {
  const responseText = review.ownerResponseText?.trim() ?? "";
  const lower = responseText.toLowerCase();
  const evidence: string[] = [];

  const generic = isGenericResponse(responseText);
  if (generic) evidence.push("Short canned thank-you style reply");

  const reviewerFirstName = firstName(review.reviewerName);
  const mentionsReviewer = Boolean(reviewerFirstName && lower.includes(reviewerFirstName));
  if (mentionsReviewer && reviewerFirstName) evidence.push(`Mentions reviewer name (${reviewerFirstName})`);

  const sharedTokens = sharedSpecificTokens(review.reviewText, responseText);
  const serviceToken = SERVICE_TERMS.find((term) => sharedTokens.includes(term));
  const personalized = mentionsReviewer || sharedTokens.length >= 2 || Boolean(serviceToken);
  if (sharedTokens.length >= 2) evidence.push(`Shares specific review terms: ${sharedTokens.slice(0, 4).join(", ")}`);
  else if (serviceToken) evidence.push(`Mentions service detail: ${serviceToken}`);

  if (copyPasteClusterId) evidence.push(`Repeated response cluster ${copyPasteClusterId}`);

  const defensivePhrase = containsAny(responseText, DEFENSIVE_PHRASES);
  const defensive = Boolean(defensivePhrase);
  if (defensivePhrase) evidence.push(`Defensive phrase: "${defensivePhrase}"`);

  const complaints = complaintTokens(review.reviewText);
  const addressesIssue =
    complaints.some((token) => lower.includes(token)) ||
    (review.rating != null && review.rating <= 3 && /\b(sorry|apolog(?:y|ize|ise|ies|ized|ised))\b/i.test(responseText));
  if (addressesIssue) {
    evidence.push(
      complaints.some((token) => lower.includes(token))
        ? "References a complaint from the review"
        : "Apologizes on a low-rated review"
    );
  }

  const resolutionPhrase = containsAny(responseText, RESOLUTION_PHRASES);
  const offersResolution = Boolean(resolutionPhrase);
  if (resolutionPhrase) evidence.push(`Resolution phrase: "${resolutionPhrase}"`);

  return {
    reviewId: review.id,
    personalized,
    generic,
    copyPasteClusterId,
    defensive,
    addressesIssue,
    offersResolution,
    evidence,
  };
}

function buildResponseQualityRows(reviews: AuditableReview[]): ResponseQualityRow[] {
  const answered = reviews.filter((review) => hasOwnerResponse(review.ownerResponseText));
  const clusters = new Map<string, number>();
  for (const review of answered) {
    const key = clusterKey(review.ownerResponseText!);
    if (key.length >= 12) clusters.set(key, (clusters.get(key) ?? 0) + 1);
  }

  const clusterIds = new Map<string, string>();
  let idx = 1;
  for (const [key, count] of clusters) {
    if (count <= 1) continue;
    clusterIds.set(key, `copy-${idx}`);
    idx++;
  }

  return answered.map((review) => {
    const key = clusterKey(review.ownerResponseText!);
    return analyzeResponseQuality(review, clusterIds.get(key) ?? null);
  });
}

function summarizeQuality(rows: ResponseQualityRow[]): ResponseQualitySummary {
  return {
    personalizedPct: pct(rows.filter((row) => row.personalized).length, rows.length),
    genericPct: pct(rows.filter((row) => row.generic).length, rows.length),
    copyPastePct: pct(rows.filter((row) => row.copyPasteClusterId).length, rows.length),
    defensiveCount: rows.filter((row) => row.defensive).length,
    addressesIssuePct: pct(rows.filter((row) => row.addressesIssue).length, rows.length),
    offersResolutionPct: pct(rows.filter((row) => row.offersResolution).length, rows.length),
  };
}

function averageResponseTimeDays(rows: AuditableReview[]): number | null {
  const durations = rows.flatMap((row) => {
    if (!hasOwnerResponse(row.ownerResponseText) || !row.publishedAt || !row.ownerRespondedAt) return [];
    const days = (row.ownerRespondedAt.getTime() - row.publishedAt.getTime()) / 86_400_000;
    return Number.isFinite(days) && days >= 0 ? [days] : [];
  });
  if (!durations.length) return null;
  return Math.round((durations.reduce((sum, days) => sum + days, 0) / durations.length) * 10) / 10;
}

function auditAuditableOwnerResponses(reviews: AuditableReview[], includeTiming: boolean): ResponseAudit {
  const withText = reviews.filter((r) => (r.reviewText ?? "").trim().length > 0);
  const answered = withText.filter((r) => hasOwnerResponse(r.ownerResponseText));
  const unanswered = withText.filter((r) => !hasOwnerResponse(r.ownerResponseText));

  let unansweredPositive = 0;
  let unansweredNegative = 0;
  let unansweredNeutral = 0;

  for (const r of unanswered) {
    const sent = sentimentFromRating(r.rating);
    if (sent === "positive") unansweredPositive++;
    else if (sent === "negative") unansweredNegative++;
    else unansweredNeutral++;
  }

  const responseQualityRows = buildResponseQualityRows(withText);
  const qualitySummary = summarizeQuality(responseQualityRows);

  const audit: ResponseAudit = {
    responseRate: pct(answered.length, withText.length),
    totalWithText: withText.length,
    answered: answered.length,
    unansweredPositive,
    unansweredNegative,
    unansweredNeutral,
    genericResponseSuspected: responseQualityRows.filter((row) => row.generic).length,
    qualitySummary,
    responseQualityRows,
  };

  if (includeTiming) audit.avgResponseTimeDays = averageResponseTimeDays(withText);
  return audit;
}

export function auditOwnerResponses(reviews: NormalizedReview[]): ResponseAudit {
  return auditAuditableOwnerResponses(
    reviews.map((review) => ({
      id: review.sourceReviewId ?? undefined,
      reviewerName: review.reviewerName,
      rating: review.rating,
      reviewText: review.reviewText,
      ownerResponseText: review.ownerResponseText,
      publishedAt: review.publishedAt ?? review.reviewDate,
      ownerRespondedAt: review.ownerRespondedAt,
    })),
    true
  );
}

export function auditOwnerResponsesFromStored(rows: StoredResponseAuditRow[]): ResponseAudit {
  return auditAuditableOwnerResponses(
    rows.map((row) => ({
      id: row.id,
      reviewerName: row.reviewer_name,
      rating: row.rating != null ? Number(row.rating) : null,
      reviewText: row.review_text,
      ownerResponseText: row.owner_response_text,
      publishedAt: row.published_at ? new Date(row.published_at) : null,
      ownerRespondedAt: row.owner_responded_at ? new Date(row.owner_responded_at) : null,
    })),
    true
  );
}

export function sentimentLabel(rating: number | null): string {
  return sentimentFromRating(rating);
}
