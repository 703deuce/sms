import {
  BUSINESS_MATCH_LIST_THRESHOLD,
  MEMORABLE_NUMBER_QUALITY_THRESHOLD,
} from "./scoring-config";
import type { ScoredCandidate, KeywordEntry } from "./types";
import { longestMatchedWordLength } from "./industry-keywords";
import { quotePremiumPrice, type PremiumSearchMode } from "./premium-pricing";
import { buildVanityDisplay } from "./vanity-display";

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
  headlineLabel: string;
  cardBullets: string[];
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
  if (score >= 85) return "Excellent Match";
  if (score >= 75) return "Strong Business Match";
  if (score >= 55) return "Good Business Match";
  if (matchedWords.length) return "Keyword Match";
  return "No Business Match";
}

function memorabilityLabel(nq: number, hasBusinessWord: boolean): string {
  if (nq >= 80) return hasBusinessWord ? "Exceptional Match" : "Exceptional Number";
  if (nq >= 55) return "Very Memorable";
  if (nq >= 40) return "Memorable";
  if (nq >= 25) return "Nice Pattern";
  return "Standard";
}

function simplifyReason(reason: string): string | null {
  const lower = reason.toLowerCase();
  if (lower.includes("four-digit repeater")) return "Four-digit repeating ending";
  if (lower.includes("sequence")) return "Easy numeric sequence";
  if (lower.includes("palindrome")) return "Memorable palindrome pattern";
  if (lower.includes("exact") && lower.includes("keyword ending")) {
    const wordMatch = reason.match(/\(([A-Z]+)/);
    const word = wordMatch?.[1];
    const lenMatch = reason.match(/(\d)-digit/);
    const len = lenMatch?.[1];
    if (word && len) return `Exact ${len}-letter ${word.toLowerCase()} match`;
    return "Exact industry keyword match";
  }
  if (lower.includes("primary industry")) return "Primary industry keyword";
  if (lower.includes("clean exact")) return "Clean word placement at end of number";
  if (lower.includes("simplicity")) return "Simple, easy-to-read number";
  if (lower.includes("memorable numeric")) return "Memorable numeric pattern";
  if (lower.includes("provider")) return null;
  return null;
}

function buildCardBullets(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  areaCode: string,
  wordLen: number,
): string[] {
  const bullets: string[] = [];
  const hasWord = candidate.matchedWords.length > 0;

  for (const r of [...candidate.businessReasons, ...candidate.numberQualityReasons]) {
    if (r.points <= 0) continue;
    const simplified = simplifyReason(r.label);
    if (simplified && !bullets.includes(simplified)) bullets.push(simplified);
    if (bullets.length >= 3) break;
  }

  if (mode === "business" && hasWord && wordLen >= 4 && bullets.length < 3) {
    const word = candidate.matchedWords[0];
    const exact = `Exact ${wordLen}-letter ${word.toLowerCase()} match`;
    if (!bullets.some((b) => b.includes("letter"))) bullets.unshift(exact);
  }

  if (areaCode && bullets.length < 3) {
    const local = `Local ${areaCode} area code`;
    if (!bullets.includes(local)) bullets.push(local);
  }

  if (mode === "business" && hasWord && wordLen >= 4 && bullets.length < 3) {
    bullets.push("Easy to say and advertise");
  }

  if (!hasWord && candidate.numberQualityScore >= 55 && bullets.length < 3) {
    if (!bullets.some((b) => b.includes("remember"))) {
      bullets.push("Very easy to remember");
    }
  }

  return bullets.slice(0, 3);
}

function buildHeadlineLabel(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
): string {
  const matchLabel =
    mode === "business" && candidate.businessMatchScore >= 55
      ? businessMatchLabel(candidate.businessMatchScore, candidate.matchedWords)
      : memorabilityLabel(candidate.numberQualityScore, candidate.matchedWords.length > 0);

  const word = candidate.matchedWords[0];
  if (word && candidate.businessMatchScore >= 55) {
    return `${matchLabel} · ${word}`;
  }
  return matchLabel;
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
  areaCode?: string,
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

  const bmLabel = businessMatchLabel(candidate.businessMatchScore, candidate.matchedWords);
  const memLabel = memorabilityLabel(
    candidate.numberQualityScore,
    candidate.matchedWords.length > 0,
  );

  return {
    resultId: candidate.phoneNumber,
    phoneNumber: candidate.phoneNumber,
    displayNumber: candidate.formattedNumber,
    vanityDisplay,
    businessMatchScore: candidate.businessMatchScore,
    numberQualityScore: candidate.numberQualityScore,
    matchedWords: candidate.matchedWords,
    patterns: candidate.matchedPatterns,
    businessMatchLabel: bmLabel,
    memorabilityLabel: memLabel,
    premiumPriceCents: price.premiumPriceCents,
    premiumPriceBand: price.band,
    headlineLabel: buildHeadlineLabel(candidate, mode),
    cardBullets: buildCardBullets(candidate, mode, areaCode ?? "", wordLen),
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
      .map((c) => toProductResult(c, mode, keywords, "top_pick", input.areaCode));

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
    .map((c) => toProductResult(c, mode, keywords, "business_match", input.areaCode));

  const memorableAlternatives = candidates
    .filter(
      (c) =>
        c.businessMatchScore < BUSINESS_MATCH_LIST_THRESHOLD &&
        c.numberQualityScore >= MEMORABLE_NUMBER_QUALITY_THRESHOLD,
    )
    .sort((a, b) => b.numberQualityScore - a.numberQualityScore)
    .slice(0, 24)
    .map((c) => toProductResult(c, mode, keywords, "memorable_alternative", input.areaCode));

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
