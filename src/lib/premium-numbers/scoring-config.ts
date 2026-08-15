/**
 * Tunable scoring weights for vanity number ranking.
 * Tuned after first live Telnyx inventory test (2026-08-15).
 */
export const SCORING_WEIGHTS = {
  word: {
    /** Exact ending on primary industry keyword (subscriber digits). */
    exactEndingPrimary: {
      seven: 75,
      six: 68,
      five: 62,
      four: 55,
      three: 25,
    },
    /** Exact ending on secondary/custom keyword (not primary industry list). */
    exactEndingSecondary: {
      seven: 45,
      six: 40,
      five: 35,
      four: 28,
      three: 12,
    },
    contains: {
      sixSeven: 22,
      fourFive: 15,
      three: 6,
    },
    industryPrimaryBonus: 10,
    industrySecondaryBonus: 5,
    cleanPlacementBonus: 10,
    memorablePrefixBonus: 12,
  },
  pattern: {
    /** Mutually exclusive tail family — only strongest applies. */
    last4AllIdentical: 45,
    ends0000: 45,
    exceptionalRepetition: 58,
    fullPalindrome: 50,
    ababOrRepeatedPair: 38,
    sequence: 38,
    palindromeLast4: 20,
    endsX000: 20,
    last3Identical: 15,
    triplePrefix: 15,
  },
  combination: {
    strongWordAndPattern: 12,
    exceptionalSimplicity: 5,
  },
  providerCost: {
    baselineMonthly: 1,
    premiumThreshold: 2,
    highPremiumThreshold: 4,
    premiumBonus: 5,
    highPremiumBonus: 8,
  },
  penalties: {
    shortAccidental: 8,
    conflictingInterpretations: 6,
    hardToRemember: 8,
    weakKeywordOnly: 5,
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
