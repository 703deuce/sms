import { SCORING_WEIGHTS } from "./scoring-config";

export type DetectedPattern = {
  id: string;
  label: string;
  points: number;
  strength: "strong" | "medium" | "weak";
  family: "tail" | "prefix" | "full" | "ends";
};

function reverseDigits(s: string): string {
  return s.split("").reverse().join("");
}

function isAbabOrRepeatedPair(last4: string): boolean {
  return /^(\d{2})\1$/.test(last4) || /^(\d)(\d)\1\2$/.test(last4);
}

/** One strongest tail pattern — no stacking 1111 as identical + palindrome + ABAB. */
function detectTailPattern(subscriber: string): DetectedPattern | null {
  const last4 = subscriber.slice(-4);
  const last3 = subscriber.slice(-3);

  if (last4 === "0000") {
    return {
      id: "ends_0000",
      label: "Ends in 0000",
      points: SCORING_WEIGHTS.pattern.ends0000,
      strength: "strong",
      family: "tail",
    };
  }

  if (/^(\d)\1{3}$/.test(last4)) {
    return {
      id: "last4_identical",
      label: `Four-digit repeater (${last4})`,
      points: SCORING_WEIGHTS.pattern.last4AllIdentical,
      strength: "strong",
      family: "tail",
    };
  }

  if (isAbabOrRepeatedPair(last4)) {
    return {
      id: "abab_pair",
      label: `Repeating pair (${last4})`,
      points: SCORING_WEIGHTS.pattern.ababOrRepeatedPair,
      strength: "medium",
      family: "tail",
    };
  }

  if (last4 === "1234" || last4 === "4321") {
    return {
      id: "sequence",
      label: `Sequence (${last4})`,
      points: SCORING_WEIGHTS.pattern.sequence,
      strength: "medium",
      family: "tail",
    };
  }

  if (last4 === reverseDigits(last4)) {
    return {
      id: "palindrome_last4",
      label: `Palindrome (${last4})`,
      points: SCORING_WEIGHTS.pattern.palindromeLast4,
      strength: "medium",
      family: "tail",
    };
  }

  if (/^(\d)\1{2}$/.test(last3)) {
    return {
      id: "last3_identical",
      label: `Last three identical (${last3})`,
      points: SCORING_WEIGHTS.pattern.last3Identical,
      strength: "weak",
      family: "tail",
    };
  }

  if (/000$/.test(subscriber)) {
    return {
      id: "ends_x000",
      label: "Ends in X000",
      points: SCORING_WEIGHTS.pattern.endsX000,
      strength: "medium",
      family: "ends",
    };
  }

  return null;
}

function detectFullSubscriberPattern(subscriber: string): DetectedPattern | null {
  if (/^(\d)\1{6}$/.test(subscriber)) {
    return {
      id: "exceptional_repetition",
      label: "Exceptional digit repetition (full subscriber)",
      points: SCORING_WEIGHTS.pattern.exceptionalRepetition,
      strength: "strong",
      family: "full",
    };
  }
  if (subscriber === reverseDigits(subscriber)) {
    return {
      id: "full_palindrome",
      label: "Full subscriber palindrome",
      points: SCORING_WEIGHTS.pattern.fullPalindrome,
      strength: "strong",
      family: "full",
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
      points: SCORING_WEIGHTS.pattern.triplePrefix,
      strength: "medium",
      family: "prefix",
    };
  }
  return null;
}

/**
 * Returns non-overlapping numeric patterns (one per family max).
 * Tail repeater 1111 does not stack palindrome/ABAB bonuses on the same digits.
 */
export function detectNumericPatterns(subscriber: string): DetectedPattern[] {
  if (subscriber.length !== 7) return [];

  const patterns: DetectedPattern[] = [];
  const full = detectFullSubscriberPattern(subscriber);
  if (full) patterns.push(full);

  const tail = detectTailPattern(subscriber);
  if (tail) patterns.push(tail);

  const prefix = detectPrefixPattern(subscriber);
  // Skip prefix if it's the same repetition already credited via full/tail (e.g. 4444444).
  if (prefix && !full && tail?.id !== "last4_identical") {
    patterns.push(prefix);
  }

  return patterns;
}

export function simplicityScore(subscriber: string): number {
  const unique = new Set(subscriber.split(""));
  if (unique.size <= 2) return SCORING_WEIGHTS.combination.exceptionalSimplicity;
  if (unique.size === 3) return 3;
  return 0;
}

export function hasMemorablePrefix(subscriber: string): boolean {
  const first3 = subscriber.slice(0, 3);
  return /^(\d)\1{2}$/.test(first3);
}
