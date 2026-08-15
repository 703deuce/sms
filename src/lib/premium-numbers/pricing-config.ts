/**
 * Central premium-number pricing (one-time acquisition, cents).
 * Adjust launch prices here — UI and scoring read from this module only.
 */

export type PersonalCustomerTier = "nice" | "memorable" | "very_memorable" | "exceptional";

export type PersonalPatternKind =
  | "AAAA"
  | "ABAB"
  | "SEQUENCE"
  | "A000"
  | "AABB"
  | "ABBA_WEAK"
  | "FULL_RHYTHM_EXCEPTIONAL"
  | "FULL_RHYTHM"
  | "NONE";

/** Launch ladder for Personal memorable numbers (USD cents). */
export const PERSONAL_PRICING = {
  nice: { min: 500, max: 900, default: 500 },
  memorable: { min: 1500, max: 1900, default: 1900 },
  veryMemorable: { min: 2900, max: 3900, default: 2900 },
  exceptional: { min: 4900, default: 5900 },
  /** Pattern-specific overrides (launch test prices). */
  patternOverrides: {
    AAAA: 3900,
    ABAB: 1900,
    SEQUENCE: 1900,
    A000: 1900,
    AABB: 900,
    ABBA_WEAK: 500,
    FULL_RHYTHM_EXCEPTIONAL: 5900,
    FULL_RHYTHM: 4900,
  } as Record<PersonalPatternKind, number | undefined>,
  /** Optional multiplier for scarce area codes (212, 310, …). */
  highDemandAreaCodes: ["212", "310", "305", "415", "202", "702", "718"],
  highDemandAreaMultiplier: 1.35,
  minimumMarginCents: 300,
} as const;

/** Launch ladder for Business vanity-word numbers (USD cents). */
export const BUSINESS_PRICING = {
  weakThreeLetter: 2900,
  embeddedFourLetter: 3900,
  secondaryFourLetter: 4900,
  primaryFourLetter: 7900,
  premiumPrimaryFourLetter: 9900,
  fiveLetter: 12900,
  sixPlusLetter: 19900,
  exceptionalBrand: 24900,
  /** Embedded keyword (word not at end) — below ending-match tiers. */
  embeddedPrimaryDiscount: 0.55,
  minimumMarginCents: 500,
  highDemandAreaCodes: PERSONAL_PRICING.highDemandAreaCodes,
  highDemandAreaBonusCents: 2000,
} as const;

export function isHighDemandAreaCode(areaCode: string): boolean {
  return PERSONAL_PRICING.highDemandAreaCodes.includes(areaCode);
}

export function applyProviderFloor(
  calculatedCents: number,
  providerCostCents: number,
  minimumMarginCents: number,
): number {
  const floor = providerCostCents + minimumMarginCents;
  return Math.max(calculatedCents, floor);
}

export function providerCostCentsFromTelnyx(telnyxCost?: {
  upfrontCost?: string;
  monthlyCost?: string;
}): number {
  const upfront = Number(telnyxCost?.upfrontCost);
  const monthly = Number(telnyxCost?.monthlyCost);
  let cents = 0;
  if (Number.isFinite(upfront) && upfront > 0) cents += Math.round(upfront * 100);
  if (Number.isFinite(monthly) && monthly > 0) cents += Math.round(monthly * 100);
  return cents;
}
