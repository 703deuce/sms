/**
 * Tunable scoring weights for vanity number ranking.
 * Adjust after batch Telnyx inventory tests.
 */
export const SCORING_WEIGHTS = {
  word: {
    exactEnding: {
      seven: 50,
      six: 42,
      five: 35,
      four: 28,
      three: 15,
    },
    contains: {
      sixSeven: 30,
      fourFive: 20,
      three: 8,
    },
    industryPrimary: 10,
    industrySecondary: 5,
  },
  pattern: {
    last4Identical: 40,
    last3Identical: 22,
    repeatedPair: 25,
    sequence: 25,
    ends0000: 40,
    endsX000: 22,
    triplePrefix: 15,
    palindromeStrong: 25,
    palindromeWeak: 15,
    abab: 20,
  },
  combination: {
    strongWordAndPattern: 15,
    exceptionalSimplicity: 5,
  },
  penalties: {
    awkwardPosition: 12,
    shortAccidental: 10,
    conflictingInterpretations: 8,
    hardToRemember: 10,
    weakKeywordOnly: 6,
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
  { min: 95, tier: "Exceptional" },
  { min: 88, tier: "Premium" },
  { min: 80, tier: "Excellent" },
  { min: 70, tier: "Good" },
  { min: 60, tier: "Nice" },
  { min: 0, tier: "Ordinary" },
];

export function scoreToTier(score: number): import("./types").QualityTier {
  for (const row of TIER_THRESHOLDS) {
    if (score >= row.min) return row.tier;
  }
  return "Ordinary";
}
