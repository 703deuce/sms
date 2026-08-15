import {
  BUSINESS_MATCH_LIST_THRESHOLD,
  MEMORABLE_NUMBER_QUALITY_THRESHOLD,
} from "./scoring-config";
import type { ScoredCandidate, KeywordEntry } from "./types";
import { longestMatchedWordLength } from "./industry-keywords";
import { quotePremiumPrice, type PremiumSearchMode } from "./premium-pricing";
import { buildVanityDisplay, starRatingFromScores } from "./vanity-display";

export type PremiumNumberAvailabilityStatus =
  | "available"
  | "reserving"
  | "reserved"
  | "sold_or_unavailable"
  | "reservation_expired"
  | "purchase_pending"
  | "provisioned";

/** UI-safe search result — no Telnyx credentials or raw provider payloads. */
export type PremiumNumberProductResult = {
  resultId: string;
  phoneNumber: string;
  displayNumber: string;
  vanityDisplay?: string;
  businessMatchScore: number;
  numberQualityScore: number;
  matchedWords: string[];
  patterns: string[];
  businessMatchLabel: string;
  memorabilityLabel: string;
  premiumPriceCents: number;
  premiumPriceBand: string;
  starRating: number;
  tags: string[];
  whyReasons: string[];
  providerPremium: boolean;
  availabilityStatus: PremiumNumberAvailabilityStatus;
  listSection: "business_match" | "memorable_alternative" | "top_pick" | "other";
};

export type PremiumSearchProductResponse = {
  mode: PremiumSearchMode;
  areaCode: string;
  industry?: string;
  status: string;
  message?: string;
  resultCount: number;
  businessMatchCount: number;
  memorableCount: number;
  bestMatches: PremiumNumberProductResult[];
  memorableAlternatives: PremiumNumberProductResult[];
  topPicks?: PremiumNumberProductResult[];
  searchLogId?: string;
};

function businessMatchLabel(score: number, matchedWords: string[]): string {
  if (score >= 75) return "Strong Business Match";
  if (score >= 55) return "Good Business Match";
  if (matchedWords.length) return "Keyword Match";
  return "No Business Match";
}

function memorabilityLabel(nq: number): string {
  if (nq >= 80) return "Exceptional";
  if (nq >= 55) return "Very Memorable";
  if (nq >= 40) return "Memorable";
  if (nq >= 25) return "Nice Pattern";
  return "Standard";
}

function buildTags(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  wordLen: number,
): string[] {
  const tags: string[] = [];
  if (mode === "business" && candidate.businessMatchScore >= BUSINESS_MATCH_LIST_THRESHOLD) {
    tags.push("Smart Match");
    tags.push("Local");
  }
  if (candidate.matchedWords[0]) tags.push(candidate.matchedWords[0]);
  if (candidate.numberQualityScore >= 80) tags.push("Highly Memorable");
  if (wordLen >= 5) tags.push(`${wordLen}-letter word`);
  for (const p of candidate.matchedPatterns.slice(0, 1)) {
    if (p.toLowerCase().includes("repeater")) tags.push(p.replace(/\(.*\)/, "").trim());
  }
  return [...new Set(tags)].slice(0, 3);
}

function whyReasons(candidate: ScoredCandidate): string[] {
  const reasons: string[] = [];
  for (const r of candidate.businessReasons) {
    if (r.points > 0) reasons.push(r.label);
  }
  for (const r of candidate.numberQualityReasons) {
    if (r.points > 0) reasons.push(r.label);
  }
  return reasons.slice(0, 6);
}

export function toProductResult(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  keywords: KeywordEntry[],
  listSection: PremiumNumberProductResult["listSection"],
): PremiumNumberProductResult {
  const wordLen = longestMatchedWordLength(candidate.matchedWords, keywords);
  const telnyxVanity = candidate.rawTelnyx?.vanity_format as string | undefined;
  const vanityDisplay = buildVanityDisplay(
    candidate.phoneNumber,
    candidate.matchedWords,
    telnyxVanity,
  );
  const price = quotePremiumPrice(candidate, mode, wordLen);
  const monthly = Number(candidate.telnyxCost?.monthlyCost);
  const providerPremium = Number.isFinite(monthly) && monthly >= 2;

  return {
    resultId: candidate.phoneNumber,
    phoneNumber: candidate.phoneNumber,
    displayNumber: candidate.formattedNumber,
    vanityDisplay,
    businessMatchScore: candidate.businessMatchScore,
    numberQualityScore: candidate.numberQualityScore,
    matchedWords: candidate.matchedWords,
    patterns: candidate.matchedPatterns,
    businessMatchLabel: businessMatchLabel(candidate.businessMatchScore, candidate.matchedWords),
    memorabilityLabel: memorabilityLabel(candidate.numberQualityScore),
    premiumPriceCents: price.premiumPriceCents,
    premiumPriceBand: price.band,
    starRating: starRatingFromScores(
      candidate.businessMatchScore,
      candidate.numberQualityScore,
    ),
    tags: buildTags(candidate, mode, wordLen),
    whyReasons: whyReasons(candidate),
    providerPremium,
    availabilityStatus: "available",
    listSection,
  };
}

export function buildProductSearchResponse(input: {
  mode: PremiumSearchMode;
  areaCode: string;
  industry?: string;
  status: string;
  message?: string;
  candidates: ScoredCandidate[];
  keywords: KeywordEntry[];
  searchLogId?: string;
}): PremiumSearchProductResponse {
  const { mode, candidates, keywords } = input;

  if (mode === "personal") {
    const topPicks = candidates
      .filter((c) => c.numberQualityScore >= MEMORABLE_NUMBER_QUALITY_THRESHOLD)
      .slice(0, 24)
      .map((c) => toProductResult(c, mode, keywords, "top_pick"));

    return {
      mode,
      areaCode: input.areaCode,
      status: input.status,
      message: input.message,
      resultCount: candidates.length,
      businessMatchCount: 0,
      memorableCount: topPicks.length,
      bestMatches: [],
      memorableAlternatives: [],
      topPicks,
      searchLogId: input.searchLogId,
    };
  }

  const businessMatches = candidates
    .filter((c) => c.businessMatchScore >= BUSINESS_MATCH_LIST_THRESHOLD)
    .sort((a, b) => {
      if (b.businessMatchScore !== a.businessMatchScore) {
        return b.businessMatchScore - a.businessMatchScore;
      }
      return b.numberQualityScore - a.numberQualityScore;
    })
    .slice(0, 24)
    .map((c) => toProductResult(c, mode, keywords, "business_match"));

  const memorableAlternatives = candidates
    .filter(
      (c) =>
        c.businessMatchScore < BUSINESS_MATCH_LIST_THRESHOLD &&
        c.numberQualityScore >= MEMORABLE_NUMBER_QUALITY_THRESHOLD,
    )
    .sort((a, b) => b.numberQualityScore - a.numberQualityScore)
    .slice(0, 24)
    .map((c) => toProductResult(c, mode, keywords, "memorable_alternative"));

  return {
    mode,
    areaCode: input.areaCode,
    industry: input.industry,
    status: input.status,
    message: input.message,
    resultCount: candidates.length,
    businessMatchCount: businessMatches.length,
    memorableCount: memorableAlternatives.length,
    bestMatches: businessMatches,
    memorableAlternatives,
    searchLogId: input.searchLogId,
  };
}

/** Industry labels for the searchable dropdown. */
export const PREMIUM_INDUSTRY_OPTIONS = [
  { value: "roofing", label: "Roofing" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "lawn_care", label: "Lawn Care" },
  { value: "junk_removal", label: "Junk Removal" },
  { value: "moving", label: "Moving" },
  { value: "legal", label: "Legal" },
  { value: "dental", label: "Dental" },
  { value: "auto", label: "Auto" },
] as const;
