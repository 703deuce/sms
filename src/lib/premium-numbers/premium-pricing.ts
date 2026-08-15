import type { ScoredCandidate } from "./types";

export type PremiumSearchMode = "business" | "personal";

/**
 * Configurable Transovo premium acquisition pricing (one-time, cents).
 * Customer price is NOT derived from Telnyx monthly DID cost.
 */
export const PREMIUM_PRICE_POLICY = {
  personal: {
    normal: 0,
    nice: 1900,
    memorable: 2900,
    exceptional: 7900,
  },
  business: {
    good: 4900,
    strong: 9900,
    premium: 14900,
    exceptional: 29900,
  },
} as const;

export type PremiumPriceBand =
  | "normal"
  | "nice"
  | "memorable"
  | "exceptional"
  | "good"
  | "strong"
  | "premium";

export type PremiumPriceQuote = {
  premiumPriceCents: number;
  band: PremiumPriceBand;
  displayLabel: string;
};

export function quotePremiumPrice(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  matchedWordLength?: number,
): PremiumPriceQuote {
  const wordLen =
    matchedWordLength ??
    candidate.matchedWords.reduce((max, w) => Math.max(max, w.length), 0);

  if (mode === "personal") {
    const nq = candidate.numberQualityScore;
    if (nq >= 80) {
      return {
        premiumPriceCents: PREMIUM_PRICE_POLICY.personal.exceptional,
        band: "exceptional",
        displayLabel: "Exceptional",
      };
    }
    if (nq >= 55) {
      return {
        premiumPriceCents: PREMIUM_PRICE_POLICY.personal.memorable,
        band: "memorable",
        displayLabel: "Memorable",
      };
    }
    if (nq >= 35) {
      return {
        premiumPriceCents: PREMIUM_PRICE_POLICY.personal.nice,
        band: "nice",
        displayLabel: "Nice",
      };
    }
    return {
      premiumPriceCents: PREMIUM_PRICE_POLICY.personal.normal,
      band: "normal",
      displayLabel: "Standard",
    };
  }

  const bm = candidate.businessMatchScore;
  if (wordLen >= 6 || bm >= 85) {
    return {
      premiumPriceCents: PREMIUM_PRICE_POLICY.business.exceptional,
      band: "exceptional",
      displayLabel: "Exceptional Business Match",
    };
  }
  if (wordLen >= 5 || bm >= 75) {
    return {
      premiumPriceCents: PREMIUM_PRICE_POLICY.business.strong,
      band: "strong",
      displayLabel: "Strong Business Match",
    };
  }
  if (bm >= 65) {
    return {
      premiumPriceCents: PREMIUM_PRICE_POLICY.business.premium,
      band: "premium",
      displayLabel: "Premium Business Match",
    };
  }
  if (wordLen >= 4 || bm >= 55) {
    return {
      premiumPriceCents: PREMIUM_PRICE_POLICY.business.good,
      band: "good",
      displayLabel: "Good Business Match",
    };
  }

  const nq = candidate.numberQualityScore;
  if (nq >= 80) {
    return {
      premiumPriceCents: PREMIUM_PRICE_POLICY.personal.exceptional,
      band: "exceptional",
      displayLabel: "Exceptional",
    };
  }
  if (nq >= 55) {
    return {
      premiumPriceCents: PREMIUM_PRICE_POLICY.personal.memorable,
      band: "memorable",
      displayLabel: "Memorable",
    };
  }
  return {
    premiumPriceCents: PREMIUM_PRICE_POLICY.personal.nice,
    band: "nice",
    displayLabel: "Nice",
  };
}

export function formatPremiumPrice(cents: number): string {
  if (cents <= 0) return "$0";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
