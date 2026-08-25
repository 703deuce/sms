import type { ScoredCandidate } from "./types";
import type { WordPlacement } from "./vanity-display";

export type PremiumSearchMode = "business" | "personal";

/**
 * Authoritative acquisition-price policy. All values are one-time retail cents.
 * Normal provider carrying cost is covered by service fees; only incremental
 * provider economics can raise the acquisition price.
 */
export const PREMIUM_PRICE_POLICY = {
  personal: {
    tiers: [499, 799, 999, 1499, 1999, 2999, 3999],
    scoreBreaks: [7, 20, 34, 49, 67, 87],
  },
  business: {
    good: 4900,
    strong: 9900,
    premium: 14900,
    exceptional: 29900,
  },
  providerFloor: {
    /** Normal monthly carrier cost assumed covered by the recurring service fee. */
    normalMonthlyServiceCostAllowanceCents: 150,
    /** Fixed policy horizon for recovering incremental carrier cost; not environment-specific. */
    incrementalCostRecoveryHorizonMonths: 12,
    costMultiplier: 1.5,
    minimumMarginCents: 300,
  },
} as const;

export type PremiumPriceBand =
  | "personal_499"
  | "personal_799"
  | "personal_999"
  | "personal_1499"
  | "personal_1999"
  | "personal_2999"
  | "personal_3999"
  | "provider_floor"
  | "good"
  | "strong"
  | "premium"
  | "exceptional";

export type PremiumPriceQuote = {
  premiumPriceCents: number;
  band: PremiumPriceBand;
  displayLabel: string;
  providerFloorCents: number;
};

function parseMoneyCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value * 100));
  if (typeof value !== "string") return 0;
  const normalized = value.trim().replace(/[$,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

export function normalizedProviderCosts(candidate: ScoredCandidate): {
  upfrontCents: number;
  monthlyCents: number;
} {
  const raw = candidate.rawTelnyx ?? {};
  return {
    upfrontCents: parseMoneyCents(
      candidate.telnyxCost?.upfrontCost ??
        raw.upfront_cost ??
        raw.upfrontCost ??
        raw.setup_cost,
    ),
    monthlyCents: parseMoneyCents(
      candidate.telnyxCost?.monthlyCost ??
        raw.monthly_cost ??
        raw.monthlyCost ??
        raw.monthly_price,
    ),
  };
}

export function providerEconomicsFloorCents(candidate: ScoredCandidate): number {
  const { upfrontCents, monthlyCents } = normalizedProviderCosts(candidate);
  const policy = PREMIUM_PRICE_POLICY.providerFloor;
  const incrementalMonthly = Math.max(
    0,
    monthlyCents - policy.normalMonthlyServiceCostAllowanceCents,
  );
  const hardCost =
    upfrontCents + incrementalMonthly * policy.incrementalCostRecoveryHorizonMonths;
  if (hardCost <= 0) return 0;
  return Math.ceil(hardCost * policy.costMultiplier + policy.minimumMarginCents);
}

function personalQuote(candidate: ScoredCandidate): PremiumPriceQuote {
  const breaks = PREMIUM_PRICE_POLICY.personal.scoreBreaks;
  const tierIndex = breaks.findIndex((max) => candidate.numberQualityScore <= max);
  const index = tierIndex < 0 ? PREMIUM_PRICE_POLICY.personal.tiers.length - 1 : tierIndex;
  const base = PREMIUM_PRICE_POLICY.personal.tiers[index];
  const floor = providerEconomicsFloorCents(candidate);
  if (floor > base) {
    const configured = PREMIUM_PRICE_POLICY.personal.tiers.find((tier) => tier >= floor);
    const price = configured ?? Math.ceil((floor + 1) / 100) * 100 - 1;
    return {
      premiumPriceCents: price,
      band: "provider_floor",
      displayLabel: "Premium Pattern",
      providerFloorCents: floor,
    };
  }
  const labels = [
    "Great Value",
    "Great Value",
    "Easy to Remember",
    "Clean Pattern",
    "Very Memorable",
    "Premium Pattern",
    "Premium Pattern",
  ];
  return {
    premiumPriceCents: base,
    band: `personal_${base}` as PremiumPriceBand,
    displayLabel: labels[index],
    providerFloorCents: floor,
  };
}

export function quotePremiumPrice(
  candidate: ScoredCandidate,
  mode: PremiumSearchMode,
  matchedWordLength?: number,
  wordPlacement?: WordPlacement,
): PremiumPriceQuote {
  const wordLen =
    matchedWordLength ??
    candidate.matchedWords.reduce((max, w) => Math.max(max, w.length), 0);

  if (mode === "personal") {
    return personalQuote(candidate);
  }

  // Embedded keyword (not at end) — valuable but far below ending-word premiums.
  if (wordPlacement === "embedded") {
    return { ...personalQuote(candidate), displayLabel: "Embedded Keyword" };
  }

  const bm = candidate.businessMatchScore;
  const floor = providerEconomicsFloorCents(candidate);
  const businessQuote = (
    premiumPriceCents: number,
    band: PremiumPriceBand,
    displayLabel: string,
  ): PremiumPriceQuote => ({
    premiumPriceCents: Math.max(premiumPriceCents, floor),
    band: floor > premiumPriceCents ? "provider_floor" : band,
    displayLabel,
    providerFloorCents: floor,
  });
  if (wordLen >= 6 || bm >= 85) {
    return businessQuote(PREMIUM_PRICE_POLICY.business.exceptional, "exceptional", "Exceptional Business Match");
  }
  if (wordLen >= 5 || bm >= 75) {
    return businessQuote(PREMIUM_PRICE_POLICY.business.premium, "premium", "Premium Business Match");
  }
  if (bm >= 65) {
    return businessQuote(PREMIUM_PRICE_POLICY.business.strong, "strong", "Strong Business Match");
  }
  if (wordLen >= 4 || bm >= 55) {
    return businessQuote(PREMIUM_PRICE_POLICY.business.good, "good", "Good Business Match");
  }
  return personalQuote(candidate);
}

export function formatPremiumPrice(cents: number): string {
  if (cents <= 0) return "$0";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
