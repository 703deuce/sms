import { SCORING_WEIGHTS } from "./scoring-config";

export type DetectedPattern = {
  id: string;
  label: string;
  points: number;
  strength: "strong" | "medium" | "weak";
  family: "primary" | "prefix" | "chunk";
  patternFamily: string;
};

function reverseDigits(s: string): string {
  return s.split("").reverse().join("");
}

function isAbabOrRepeatedPair(last4: string): boolean {
  return /^(\d{2})\1$/.test(last4) || /^(\d)(\d)\1\2$/.test(last4);
}

function isRoundEnding(last4: string): boolean {
  return last4 === "1000" || last4 === "2000" || last4 === "5000";
}

function hasStrongRepeatedBlocks(subscriber: string): boolean {
  // AAA_BBBB, AAAA_BBB, or majority repeated digit runs.
  const runs = subscriber.match(/(\d)\1+/g) ?? [];
  const covered = runs.reduce((sum, r) => sum + r.length, 0);
  return covered >= 5 && runs.some((r) => r.length >= 3);
}

function fullPalindromeHasVisualRhythm(subscriber: string): boolean {
  if (subscriber !== reverseDigits(subscriber)) return false;
  const last4 = subscriber.slice(-4);
  if (/^(\d)\1{3}$/.test(last4) || isAbabOrRepeatedPair(last4)) return true;
  if (last4 === reverseDigits(last4) && last4.length === 4) return true;
  return /^(\d)\1{2}/.test(subscriber.slice(0, 3));
}

/** One primary human-salient numeric pattern — no overlapping tail/full bonuses. */
function detectPrimaryNumericPattern(subscriber: string): DetectedPattern | null {
  const nq = SCORING_WEIGHTS.numberQuality;
  const last4 = subscriber.slice(-4);
  const last3 = subscriber.slice(-3);

  if (/^(\d)\1{6}$/.test(subscriber)) {
    return {
      id: "exceptional_repetition",
      label: "Exceptional digit repetition (full subscriber)",
      points: nq.exceptionalRepetition,
      strength: "strong",
      family: "primary",
      patternFamily: "full_repetition",
    };
  }

  if (hasStrongRepeatedBlocks(subscriber) && !/^(\d)\1{6}$/.test(subscriber)) {
    return {
      id: "strong_repeated_blocks",
      label: "Strong repeated digit blocks across subscriber",
      points: nq.strongRepeatedBlocks,
      strength: "strong",
      family: "primary",
      patternFamily: "repeated_blocks",
    };
  }

  if (/^(\d)\1{3}$/.test(last4)) {
    return {
      id: "last4_identical",
      label: `Four identical ending digits (${last4})`,
      points: nq.last4AllIdentical,
      strength: "strong",
      family: "primary",
      patternFamily: "last4_identical",
    };
  }

  if (last4 === "0000") {
    return {
      id: "ends_0000",
      label: "Ends in 0000",
      points: nq.ends0000,
      strength: "medium",
      family: "primary",
      patternFamily: "round_block",
    };
  }

  if (isAbabOrRepeatedPair(last4)) {
    return {
      id: "abab_pair",
      label: `Repeating pair (${last4})`,
      points: nq.ababOrRepeatedPair,
      strength: "medium",
      family: "primary",
      patternFamily: "repeating_pair",
    };
  }

  if (last4 === "1234" || last4 === "4321") {
    return {
      id: "sequence",
      label: `Simple sequence (${last4})`,
      points: nq.sequence,
      strength: "medium",
      family: "primary",
      patternFamily: "sequence",
    };
  }

  if (isRoundEnding(last4)) {
    return {
      id: "round_ending",
      label: `Round ending (${last4})`,
      points: nq.roundEnding,
      strength: "medium",
      family: "primary",
      patternFamily: "round_block",
    };
  }

  if (last4 === reverseDigits(last4) && last4.length === 4) {
    return {
      id: "palindrome_last4",
      label: `Short palindrome ending (${last4})`,
      points: nq.shortPalindromeLast4,
      strength: "weak",
      family: "primary",
      patternFamily: "short_palindrome",
    };
  }

  if (subscriber === reverseDigits(subscriber)) {
    const points = fullPalindromeHasVisualRhythm(subscriber)
      ? nq.shortPalindromeLast4
      : nq.hiddenFullPalindrome;
    return {
      id: "full_palindrome",
      label: fullPalindromeHasVisualRhythm(subscriber)
        ? "Full subscriber palindrome with visual rhythm"
        : "Full subscriber palindrome (subtle)",
      points,
      strength: "weak",
      family: "primary",
      patternFamily: "full_palindrome",
    };
  }

  if (/^(\d)\1{2}$/.test(last3)) {
    return {
      id: "last3_identical",
      label: `Last three identical (${last3})`,
      points: nq.last3Identical,
      strength: "weak",
      family: "primary",
      patternFamily: "last3_identical",
    };
  }

  if (/000$/.test(subscriber) && !last4.endsWith("0000")) {
    return {
      id: "ends_x000",
      label: "Ends in X000",
      points: nq.roundEnding,
      strength: "weak",
      family: "primary",
      patternFamily: "round_block",
    };
  }

  return null;
}

function detectPrefixPattern(subscriber: string): DetectedPattern | null {
  const first3 = subscriber.slice(0, 3);
  if (/^(\d)\1{2}$/.test(first3)) {
    return {
      id: "triple_prefix",
      label: `Triple repeating prefix (${first3})`,
      points: SCORING_WEIGHTS.numberQuality.triplePrefix,
      strength: "medium",
      family: "prefix",
      patternFamily: "triple_prefix",
    };
  }
  return null;
}

/** How easily a person can chunk and say the subscriber digits. */
export function chunkabilityScore(subscriber: string): { points: number; label: string } {
  if (subscriber.length !== 7) return { points: 0, label: "" };
  const max = SCORING_WEIGHTS.numberQuality.chunkabilityMax;
  let points = 0;
  const last4 = subscriber.slice(-4);
  const first3 = subscriber.slice(0, 3);

  if (/^(\d)\1{3}$/.test(last4)) points += 14;
  else if (isAbabOrRepeatedPair(last4)) points += 10;
  else if (last4 === "1234" || last4 === "4321") points += 8;

  if (/^(\d)\1{2}$/.test(first3)) points += 6;

  const uniqueCount = new Set(subscriber.split("")).size;
  if (uniqueCount <= 2) points += 6;
  else if (uniqueCount === 3) points += 3;

  if (/^(\d)\1/.test(subscriber) && /^(\d)\1/.test(last4)) points += 4;

  points = Math.min(max, points);
  if (points <= 0) return { points: 0, label: "" };
  return { points, label: "Strong visual chunkability" };
}

export function simplicityScore(subscriber: string): number {
  const uniqueCount = new Set(subscriber.split("")).size;
  if (uniqueCount <= 2) return SCORING_WEIGHTS.numberQuality.simplicityMax;
  if (uniqueCount === 3) return Math.round(SCORING_WEIGHTS.numberQuality.simplicityMax / 2);
  return 0;
}

export function detectNumericPatterns(subscriber: string): DetectedPattern[] {
  if (subscriber.length !== 7) return [];

  const patterns: DetectedPattern[] = [];
  const primary = detectPrimaryNumericPattern(subscriber);
  if (primary) patterns.push(primary);

  const prefix = detectPrefixPattern(subscriber);
  if (prefix) patterns.push(prefix);

  const chunk = chunkabilityScore(subscriber);
  if (chunk.points > 0) {
    patterns.push({
      id: "chunkability",
      label: chunk.label,
      points: chunk.points,
      strength: "medium",
      family: "chunk",
      patternFamily: "chunkability",
    });
  }

  return patterns;
}

export function isIndependentNumericPattern(pattern: DetectedPattern): boolean {
  return (
    pattern.family === "prefix" ||
    (pattern.family === "primary" &&
      (pattern.strength === "strong" ||
        pattern.id === "triple_prefix" ||
        pattern.id === "last4_identical" ||
        pattern.id === "strong_repeated_blocks" ||
        pattern.id === "exceptional_repetition"))
  );
}
