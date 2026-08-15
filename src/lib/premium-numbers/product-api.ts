import {
  BUSINESS_MATCH_LIST_THRESHOLD,
  MEMORABLE_NUMBER_QUALITY_THRESHOLD,
} from "./scoring-config";
import { normalizeWord } from "./keypad";
import { quotePremiumPrice, type PremiumSearchMode } from "./premium-pricing";
import { resolveVanityPresentation, type WordPlacement } from "./vanity-display";
import type { ScoredCandidate, KeywordEntry } from "./types";

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
  /** Word letters shown in vanityDisplay. */
  displayWord?: string;
  /** Whether the keyword letters end the number or sit earlier with digits after. */
  wordPlacement?: WordPlacement;
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
  /** Analytics fields stored in search logs for purchase tuning. */
  areaCode?: string;
  patternTypes?: string[];
  lastFourPattern?: string;
  fullNumberPattern?: string;
  personalTier?: string;
  matchedWord?: string;
  keywordTier?: string;
  businessTier?: string;
  providerCostCents?: number;
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
  if (lower.includes("keyword contained")) return null;
  if (lower.includes("primary industry")) return null;
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
  displayWord?: string,
  wordPlacement?: WordPlacement,
): string[] {
  if (mode === "personal" && candidate.personalPattern) {
    const bullets = [...candidate.personalPattern.bulletLabels];
    if (areaCode && bullets.length < 3) {
      const local = `Local ${areaCode} area code`;
      if (!bullets.includes(local)) bullets.push(local);
    }
    return bullets.slice(0, 3);
  }

  const bullets: string[] = [];
  const hasDisplayWord = Boolean(displayWord);
  const displayWordLen = displayWord ? normalizeWord(displayWord).length : 0;

  for (const r of [...candidate.businessReasons, ...candidate.numberQualityReasons]) {
    if (r.points <= 0) continue;
    const simplified = simplifyReason(r.label);
    if (simplified && !bullets.includes(simplified)) bullets.push(simplified);
    if (bullets.length >= 3) break;
  }

  if (mode === "business" && hasDisplayWord && displayWordLen >= 4 && bullets.length < 3) {
    if (wordPlacement === "ending") {
      const exact = `Exact ${displayWordLen}-letter ${displayWord!.toLowerCase()} match`;
      if (!bullets.some((b) => b.includes("letter"))) bullets.unshift(exact);
    } else if (wordPlacement === "embedded") {
      const embedded = `${displayWordLen}-letter ${displayWord!.toLowerCase()} in number`;
      if (!bullets.some((b) => b.includes("letter"))) bullets.unshift(embedded);
      if (bullets.length < 3) {
        bullets.push("Additional digits after keyword");
      }
    }
  }

  if (areaCode && bullets.length < 3) {
    const local = `Local ${areaCode} area code`;
    if (!bullets.includes(local)) bullets.push(local);
  }

  if (mode === "business" && hasDisplayWord && displayWordLen >= 4 && wordPlacement === "ending" && bullets.length < 3) {
    bullets.push("Easy to say and advertise");
  }

  if (!hasDisplayWord && candidate.numberQualityScore >= 55 && bullets.length < 3) {
    if (!bullets.some((b) => b.includes("remember"))) {
      bullets.push("Very easy to remember");
    }
  }

  return bullets.slice(0, 3);
}

function buildHeadlineLabel(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  displayWord?: string,
): string {
  if (mode === "personal" && candidate.personalPattern) {
    return candidate.personalPattern.customerLabel;
  }

  const hasDisplayWord = Boolean(displayWord);
  const matchLabel =
    mode === "business" && candidate.businessMatchScore >= 55
      ? businessMatchLabel(candidate.businessMatchScore, hasDisplayWord ? [displayWord!] : [])
      : memorabilityLabel(candidate.numberQualityScore, hasDisplayWord);

  if (displayWord && candidate.businessMatchScore >= 55) {
    return `${matchLabel} · ${displayWord}`;
  }
  return matchLabel;
}

function buildTags(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  displayWord?: string,
): string[] {
  const tags: string[] = [];
  if (mode === "personal") {
    if (candidate.personalPattern) {
      tags.push(candidate.personalPattern.customerLabel);
      if (candidate.personalPattern.kind !== "NONE") {
        tags.push(candidate.personalPattern.kind.replace(/_/g, " "));
      }
    }
    return [...new Set(tags)].slice(0, 3);
  }

  const displayWordLen = displayWord ? normalizeWord(displayWord).length : 0;
  if (mode === "business" && candidate.businessMatchScore >= BUSINESS_MATCH_LIST_THRESHOLD) {
    tags.push("Smart Match");
    tags.push("Local");
  }
  if (displayWord) tags.push(displayWord);
  if (candidate.numberQualityScore >= 80) tags.push("Highly Memorable");
  if (displayWordLen >= 5) tags.push(`${displayWordLen}-letter word`);
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
  const telnyxVanity = candidate.rawTelnyx?.vanity_format as string | undefined;
  const { vanityDisplay, displayWord, wordPlacement } = resolveVanityPresentation(
    candidate.phoneNumber,
    candidate.matchedWords,
    telnyxVanity,
  );
  const wordLen = displayWord ? normalizeWord(displayWord).length : 0;
  const keywordEntry = displayWord
    ? keywords.find((k) => k.word === displayWord)
    : undefined;
  const price = quotePremiumPrice(candidate, mode, {
    wordLen,
    wordPlacement,
    areaCode,
    displayWord,
    keywords,
  });
  const monthly = Number(candidate.telnyxCost?.monthlyCost);
  const providerPremium = Number.isFinite(monthly) && monthly >= 2;
  const providerCostCents =
    Number(candidate.telnyxCost?.upfrontCost) > 0 || Number(candidate.telnyxCost?.monthlyCost) > 0
      ? Math.round(
          (Number(candidate.telnyxCost?.upfrontCost) || 0) * 100 +
            (Number(candidate.telnyxCost?.monthlyCost) || 0) * 100,
        )
      : 0;

  const bmLabel =
    mode === "personal"
      ? ""
      : businessMatchLabel(candidate.businessMatchScore, displayWord ? [displayWord] : []);
  const memLabel =
    mode === "personal" && candidate.personalPattern
      ? candidate.personalPattern.customerLabel
      : memorabilityLabel(candidate.numberQualityScore, Boolean(displayWord));

  const patternTypes =
    mode === "personal" && candidate.personalPattern
      ? [candidate.personalPattern.kind, candidate.personalPattern.lastFourPattern].filter(Boolean)
      : candidate.matchedPatterns;

  const keywordTier = keywordEntry
    ? keywordEntry.isPrimary
      ? "primary"
      : keywordEntry.isSecondary
        ? "secondary"
        : "other"
    : undefined;

  return {
    resultId: candidate.phoneNumber,
    phoneNumber: candidate.phoneNumber,
    displayNumber: candidate.formattedNumber,
    vanityDisplay,
    displayWord,
    wordPlacement,
    businessMatchScore: candidate.businessMatchScore,
    numberQualityScore: candidate.numberQualityScore,
    matchedWords: candidate.matchedWords,
    patterns: candidate.matchedPatterns,
    businessMatchLabel: mode === "personal" ? memLabel : bmLabel,
    memorabilityLabel: memLabel,
    premiumPriceCents: price.premiumPriceCents,
    premiumPriceBand: price.band,
    headlineLabel: buildHeadlineLabel(candidate, mode, displayWord),
    cardBullets: buildCardBullets(candidate, mode, areaCode ?? "", displayWord, wordPlacement),
    tags: buildTags(candidate, mode, displayWord),
    whyReasons: whyReasons(candidate),
    providerPremium,
    availabilityStatus: "available",
    listSection,
    areaCode,
    patternTypes,
    lastFourPattern: candidate.personalPattern?.lastFourPattern,
    fullNumberPattern: candidate.personalPattern?.fullNumberPattern,
    personalTier: candidate.personalPattern?.tier,
    matchedWord: displayWord,
    keywordTier,
    businessTier: mode === "business" ? price.displayLabel : undefined,
    providerCostCents,
  };
}

function candidateHasDisplayWord(candidate: ScoredCandidate): boolean {
  const telnyxVanity = candidate.rawTelnyx?.vanity_format as string | undefined;
  return Boolean(
    resolveVanityPresentation(candidate.phoneNumber, candidate.matchedWords, telnyxVanity)
      .displayWord,
  );
}

function isEndingPlacement(candidate: ScoredCandidate): boolean {
  const telnyxVanity = candidate.rawTelnyx?.vanity_format as string | undefined;
  return (
    resolveVanityPresentation(candidate.phoneNumber, candidate.matchedWords, telnyxVanity)
      .wordPlacement === "ending"
  );
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
    .filter(
      (c) =>
        c.businessMatchScore >= BUSINESS_MATCH_LIST_THRESHOLD && candidateHasDisplayWord(c),
    )
    .sort((a, b) => {
      const aEnding = isEndingPlacement(a);
      const bEnding = isEndingPlacement(b);
      if (aEnding !== bEnding) return aEnding ? -1 : 1;
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
