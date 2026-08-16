/**
 * Tunable scoring weights — business match vs number quality blend.
 * Industry searches: final list rank = 70% business match + 30% number quality.
 */
export const BUSINESS_MATCH_LIST_THRESHOLD = 55;
export const MEMORABLE_NUMBER_QUALITY_THRESHOLD = 40;

/** Hard cap for accidental 3-letter keypad matches unless explicitly requested. */
export const THREE_LETTER_BUSINESS_MATCH_CAP = 35;

export const SCORING_WEIGHTS = {
  blend: {
    businessMatch: 0.7,
    numberQuality: 0.3,
  },
  businessMatch: {
    /** Base points by exact-ending word length (before tier/placement/local bonuses). */
    exactEndingBase: {
      seven: 55,
      six: 52,
      five: 50,
      four: 40,
      three: 10,
    },
    containsBase: {
      sixSeven: 18,
      fourFive: 12,
      three: 4,
    },
    tierBonus: {
      PRIMARY: 15,
      SECONDARY: 8,
      TERTIARY: 3,
    },
    placementBonus: {
      exactEnding: 10,
      cleanEnding: 5,
      beginning: 3,
      interior: 2,
    },
    localFitMax: 20,
    areaCodeMarketDefault: 50,
  },
  numberQuality: {
    exceptionalRepetition: 95,
    strongRepeatedBlocks: 88,
    last4AllIdentical: 78,
    ends0000: 40,
    ababOrRepeatedPair: 48,
    sequence: 45,
    roundEnding: 32,
    shortPalindromeLast4: 22,
    hiddenFullPalindrome: 12,
    last3Identical: 18,
    triplePrefix: 42,
    chunkabilityMax: 22,
    simplicityMax: 8,
    wordPlusNumericBoost: 18,
  },
  providerCost: {
    baselineMonthly: 1,
    premiumThreshold: 2,
    highPremiumThreshold: 4,
    premiumSignal: 3,
    highPremiumSignal: 5,
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

export function numberQualityToLabel(score: number): import("./types").NumberQualityLabel {
  if (score >= 95) return "Signature Number";
  if (score >= 85) return "Elite Number";
  if (score >= 70) return "Premium Pattern";
  if (score >= 55) return "Highly Memorable";
  if (score >= 40) return "Memorable";
  if (score >= 25) return "Distinctive";
  return "Standard";
}

export function businessMatchToLabel(score: number): import("./types").BusinessFitLabel {
  if (score >= 95) return "Exceptional Business Match";
  if (score >= 85) return "Excellent Business Match";
  if (score >= 70) return "Strong Business Match";
  if (score >= 50) return "Good Business Match";
  if (score >= 25) return "Related";
  return "No Direct Match";
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
