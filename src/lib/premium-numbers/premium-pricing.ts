import type { ScoredCandidate, KeywordEntry } from "./types";
import type { WordPlacement } from "./vanity-display";
import {
  BUSINESS_PRICING,
  PERSONAL_PRICING,
  applyProviderFloor,
  isHighDemandAreaCode,
  providerCostCentsFromTelnyx,
  type PersonalCustomerTier,
  type PersonalPatternKind,
} from "./pricing-config";

export type PremiumSearchMode = "business" | "personal";

export type PremiumPriceBand =
  | "normal"
  | "nice"
  | "memorable"
  | "very_memorable"
  | "exceptional"
  | "good"
  | "strong"
  | "premium";

export type PremiumPriceQuote = {
  premiumPriceCents: number;
  band: PremiumPriceBand;
  displayLabel: string;
};

export type PremiumPriceContext = {
  wordLen?: number;
  wordPlacement?: WordPlacement;
  areaCode?: string;
  displayWord?: string;
  keywords?: KeywordEntry[];
};

function personalTierLabel(tier: PersonalCustomerTier): string {
  switch (tier) {
    case "exceptional":
      return "Exceptional";
    case "very_memorable":
      return "Very Memorable";
    case "memorable":
      return "Memorable";
    case "nice":
      return "Nice";
    default:
      return "Standard";
  }
}

function inferPersonalTierFromNq(nq: number): PersonalCustomerTier {
  if (nq >= 88) return "exceptional";
  if (nq >= 72) return "very_memorable";
  if (nq >= 58) return "memorable";
  if (nq >= 38) return "nice";
  return "nice";
}

function personalTierDefaultCents(tier: PersonalCustomerTier): number {
  switch (tier) {
    case "exceptional":
      return PERSONAL_PRICING.exceptional.default;
    case "very_memorable":
      return PERSONAL_PRICING.veryMemorable.default;
    case "memorable":
      return PERSONAL_PRICING.memorable.default;
    case "nice":
      return PERSONAL_PRICING.nice.default;
    default:
      return PERSONAL_PRICING.nice.default;
  }
}

function quotePersonalPrice(
  candidate: ScoredCandidate,
  ctx: PremiumPriceContext,
): PremiumPriceQuote {
  const analysis = candidate.personalPattern;
  const kind = (analysis?.kind ?? "NONE") as PersonalPatternKind;
  const tier = analysis?.tier ?? inferPersonalTierFromNq(candidate.numberQualityScore);

  let cents = personalTierDefaultCents(tier);
  const override = PERSONAL_PRICING.patternOverrides[kind];
  if (override !== undefined) cents = override;

  if (tier === "nice" && kind === "AABB") {
    cents = PERSONAL_PRICING.nice.max;
  }

  const areaCode = ctx.areaCode ?? candidate.rawDigits.slice(0, 3);
  if (isHighDemandAreaCode(areaCode)) {
    cents = Math.round(cents * PERSONAL_PRICING.highDemandAreaMultiplier);
  }

  cents = applyProviderFloor(
    cents,
    providerCostCentsFromTelnyx(candidate.telnyxCost),
    PERSONAL_PRICING.minimumMarginCents,
  );

  const band: PremiumPriceBand =
    tier === "very_memorable" ? "very_memorable" : tier === "nice" ? "nice" : tier;

  return {
    premiumPriceCents: cents,
    band,
    displayLabel: analysis?.customerLabel ?? personalTierLabel(tier),
  };
}

function keywordFlags(
  displayWord?: string,
  keywords?: KeywordEntry[],
): { isPrimary: boolean; isSecondary: boolean } {
  if (!displayWord || !keywords?.length) return { isPrimary: false, isSecondary: false };
  const entry = keywords.find((k) => k.word === displayWord);
  return {
    isPrimary: entry?.isPrimary ?? false,
    isSecondary: entry?.isSecondary ?? false,
  };
}

function businessTierLabel(band: PremiumPriceBand): string {
  switch (band) {
    case "exceptional":
      return "Exceptional Business Match";
    case "premium":
      return "Premium Business Match";
    case "strong":
      return "Strong Business Match";
    case "good":
      return "Good Business Match";
    default:
      return "Business Match";
  }
}

function quoteBusinessPrice(
  candidate: ScoredCandidate,
  ctx: PremiumPriceContext,
): PremiumPriceQuote {
  const wordLen =
    ctx.wordLen ??
    candidate.matchedWords.reduce((max, w) => Math.max(max, w.length), 0);
  const { wordPlacement, displayWord } = ctx;
  const { isPrimary, isSecondary } = keywordFlags(displayWord, ctx.keywords);
  const areaCode = ctx.areaCode ?? candidate.rawDigits.slice(0, 3);
  const highDemand = isHighDemandAreaCode(areaCode);
  const bm = candidate.businessMatchScore;

  let cents = 0;
  let band: PremiumPriceBand = "good";

  if (wordPlacement === "embedded") {
    if (wordLen >= 4 && isPrimary) {
      cents = Math.round(
        BUSINESS_PRICING.primaryFourLetter * BUSINESS_PRICING.embeddedPrimaryDiscount,
      );
      band = "good";
    } else if (wordLen >= 4) {
      cents = BUSINESS_PRICING.embeddedFourLetter;
      band = "good";
    } else {
      cents = BUSINESS_PRICING.weakThreeLetter;
      band = "good";
    }
  } else if (wordLen >= 6 || bm >= 88) {
    cents = BUSINESS_PRICING.exceptionalBrand;
    band = "exceptional";
  } else if (wordLen >= 5) {
    cents = BUSINESS_PRICING.fiveLetter;
    band = "premium";
  } else if (wordLen >= 4 && isPrimary) {
    cents = highDemand
      ? BUSINESS_PRICING.premiumPrimaryFourLetter
      : BUSINESS_PRICING.primaryFourLetter;
    band = highDemand ? "premium" : "strong";
  } else if (wordLen >= 4 || isSecondary) {
    cents = BUSINESS_PRICING.secondaryFourLetter;
    band = "good";
  } else if (wordLen === 3) {
    cents = BUSINESS_PRICING.weakThreeLetter;
    band = "good";
  } else if (bm >= BUSINESS_MATCH_MEMORABLE_THRESHOLD) {
    return quotePersonalMemorableFallback(candidate, ctx);
  } else {
    return quotePersonalMemorableFallback(candidate, ctx);
  }

  cents = applyProviderFloor(
    cents,
    providerCostCentsFromTelnyx(candidate.telnyxCost),
    BUSINESS_PRICING.minimumMarginCents,
  );

  return {
    premiumPriceCents: cents,
    band,
    displayLabel: businessTierLabel(band),
  };
}

const BUSINESS_MATCH_MEMORABLE_THRESHOLD = 55;

function quotePersonalMemorableFallback(
  candidate: ScoredCandidate,
  ctx: PremiumPriceContext,
): PremiumPriceQuote {
  const personal = quotePersonalPrice(candidate, ctx);
  return {
    ...personal,
    displayLabel:
      candidate.numberQualityScore >= 72
        ? "Very Memorable"
        : candidate.numberQualityScore >= 58
          ? "Memorable"
          : personal.displayLabel,
  };
}

export function quotePremiumPrice(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  context?: PremiumPriceContext | number,
  wordPlacementLegacy?: WordPlacement,
): PremiumPriceQuote {
  const ctx: PremiumPriceContext =
    typeof context === "number"
      ? { wordLen: context, wordPlacement: wordPlacementLegacy }
      : (context ?? { wordPlacement: wordPlacementLegacy });

  if (mode === "personal") {
    return quotePersonalPrice(candidate, ctx);
  }

  if (
    candidate.businessMatchScore >= BUSINESS_MATCH_MEMORABLE_THRESHOLD &&
    ctx.displayWord
  ) {
    return quoteBusinessPrice(candidate, ctx);
  }

  if (candidate.businessMatchScore < BUSINESS_MATCH_MEMORABLE_THRESHOLD) {
    return quotePersonalMemorableFallback(candidate, ctx);
  }

  return quoteBusinessPrice(candidate, ctx);
}

export function formatPremiumPrice(cents: number): string {
  if (cents <= 0) return "$0";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
