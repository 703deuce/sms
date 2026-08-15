/**
 * Tunable scoring weights — business match vs number quality blend.
 * Industry searches: final = 70% business match + 30% number quality.
 */
export const BUSINESS_MATCH_LIST_THRESHOLD = 55;
export const MEMORABLE_NUMBER_QUALITY_THRESHOLD = 40;

export const SCORING_WEIGHTS = {
  blend: {
    businessMatch: 0.7,
    numberQuality: 0.3,
  },
  businessMatch: {
    /** Exact primary industry keyword ending (subscriber digits). Steep length curve. */
    exactEndingPrimary: {
      seven: 100,
      six: 85,
      five: 70,
      four: 55,
      three: 20,
    },
    /** Exact non-primary keyword ending. */
    exactEndingSecondary: {
      seven: 85,
      six: 72,
      five: 58,
      four: 42,
      three: 12,
    },
    contains: {
      sixSeven: 18,
      fourFive: 12,
      three: 4,
    },
    industryPrimaryBonus: 5,
    industrySecondaryBonus: 3,
    cleanPlacementBonus: 5,
  },
  numberQuality: {
    last4AllIdentical: 85,
    ends0000: 85,
    exceptionalRepetition: 95,
    fullPalindrome: 80,
    ababOrRepeatedPair: 55,
    sequence: 55,
    palindromeLast4: 45,
    endsX000: 40,
    last3Identical: 25,
    triplePrefix: 45,
    simplicity: 5,
    wordPlusNumericBoost: 10,
  },
  providerCost: {
    baselineMonthly: 1,
    premiumThreshold: 2,
    highPremiumThreshold: 4,
    premiumBonus: 8,
    highPremiumBonus: 10,
  },
  penalties: {
    shortAccidental: 6,
    conflictingInterpretations: 5,
    weakKeywordOnly: 4,
  },
  memorablePatternSearchDigits: [
    "0000",
    "1111",
    "2222",
    "3333",
    "4444",
    "5555",
    "6666",
    "7777",
    "8888",
    "9999",
    "1000",
    "2000",
    "5000",
    "1212",
    "1313",
    "2020",
    "2323",
    "2525",
    "1234",
    "4321",
  ],
} as const;

export const TIER_THRESHOLDS: Array<{ min: number; tier: import("./types").QualityTier }> = [
  { min: 90, tier: "Exceptional" },
  { min: 80, tier: "Premium" },
  { min: 70, tier: "Excellent" },
  { min: 55, tier: "Good" },
  { min: 35, tier: "Nice" },
  { min: 0, tier: "Ordinary" },
];

export function scoreToTier(score: number): import("./types").QualityTier {
  for (const row of TIER_THRESHOLDS) {
    if (score >= row.min) return row.tier;
  }
  return "Ordinary";
}

export function blendScores(businessMatch: number, numberQuality: number): number {
  const { businessMatch: bW, numberQuality: nW } = SCORING_WEIGHTS.blend;
  return Math.max(
    0,
    Math.min(100, Math.round(businessMatch * bW + numberQuality * nW)),
  );
}

export function capDimension(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
