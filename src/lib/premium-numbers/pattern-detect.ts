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

function pattern(
  id: string,
  label: string,
  points: number,
  strength: DetectedPattern["strength"],
  family: DetectedPattern["family"],
  patternFamily: string,
): DetectedPattern {
  return { id, label, points, strength, family, patternFamily };
}

function longestSequence(subscriber: string): {
  length: number;
  direction: "ascending" | "descending";
  start: number;
  end: number;
} | null {
  let best: {
    length: number;
    direction: "ascending" | "descending";
    start: number;
    end: number;
  } | null = null;
  for (const direction of ["ascending", "descending"] as const) {
    let length = 1;
    for (let i = 1; i < subscriber.length; i++) {
      const delta = Number(subscriber[i]) - Number(subscriber[i - 1]);
      if (delta === (direction === "ascending" ? 1 : -1)) {
        length += 1;
        if (!best || length > best.length) {
          best = { length, direction, start: i - length + 1, end: i };
        }
      } else {
        length = 1;
      }
    }
  }
  return best && best.length >= 4 ? best : null;
}

/**
 * Pick one ending/full-number structure. Related patterns are deliberately
 * mutually exclusive so 0000 is not also billed as a quadruple, pair and two pairs.
 */
function detectPrimaryNumericPattern(subscriber: string): DetectedPattern | null {
  const nq = SCORING_WEIGHTS.numberQuality;
  const last4 = subscriber.slice(-4);
  const last3 = subscriber.slice(-3);
  const last2 = subscriber.slice(-2);
  const sequence = longestSequence(subscriber);

  if (/^(\d)\1{6}$/.test(subscriber)) {
    return pattern("exceptional_repetition", "Full-number repeating digits", nq.exceptionalRepetition, "strong", "primary", "full_repetition");
  }

  if (subscriber === "1234567" || subscriber === "7654321") {
    return pattern("full_sequence", `Full ${subscriber === "1234567" ? "ascending" : "descending"} sequence`, nq.fullSequence, "strong", "primary", "sequence");
  }

  if (last4 === "0000") {
    return pattern("ends_0000", "Ends in 0000", nq.ends0000, "strong", "primary", "round_block");
  }

  if (/^(\d)\1{3}$/.test(last4)) {
    return pattern("last4_identical", `Four identical ending digits (${last4})`, nq.last4AllIdentical, "strong", "primary", "quadruple");
  }

  if (/^[1-9]000$/.test(last4)) {
    return pattern("ends_x000", `Round thousand ending (${last4})`, nq.roundEnding, "medium", "primary", "round_block");
  }

  if (/^(\d)(\d)\1\2$/.test(last4) && last4[0] !== last4[1]) {
    return pattern("abab", `ABAB repeating pattern (${last4})`, nq.ababOrRepeatedPair, "medium", "primary", "abab");
  }

  if (/^(\d)\1(\d)\2$/.test(last4) && last4[0] !== last4[2]) {
    return pattern("aabb", `AABB paired pattern (${last4})`, nq.aabb, "medium", "primary", "aabb");
  }

  if (/^(\d)(\d)\2\1$/.test(last4) && last4[0] !== last4[1]) {
    return pattern("abba", `ABBA mirrored pattern (${last4})`, nq.abba, "medium", "primary", "abba");
  }

  if (sequence) {
    const atEnding = sequence.end === subscriber.length - 1;
    const points = atEnding
      ? sequence.length >= 5
        ? nq.longSequence
        : nq.sequence
      : Math.round((sequence.length >= 5 ? nq.longSequence : nq.sequence) / 3);
    return pattern("sequence", `${sequence.direction === "ascending" ? "Ascending" : "Descending"} ${sequence.length}-digit sequence`, points, points >= nq.sequence ? "medium" : "weak", "primary", "sequence");
  }

  if (/^(\d)\1{2}$/.test(last3)) {
    return pattern("last3_identical", `Triple ending digits (${last3})`, nq.last3Identical, "medium", "primary", "triple");
  }

  if (last4 === reverseDigits(last4)) {
    return pattern("palindrome_last4", `Palindrome ending (${last4})`, nq.shortPalindromeLast4, "medium", "primary", "short_palindrome");
  }

  const adjacentPairs = subscriber.match(/(\d)\1/g) ?? [];
  if (adjacentPairs.length >= 2) {
    return pattern("two_pairs", "Two repeating digit pairs", nq.twoPairs, "weak", "primary", "two_pairs");
  }

  if (/^(\d)\1$/.test(last2)) {
    return pattern("ending_pair", `Repeating ending pair (${last2})`, nq.endingPair, "weak", "primary", "ending_pair");
  }

  return null;
}

function detectWholeNumberInteraction(subscriber: string): DetectedPattern | null {
  const nq = SCORING_WEIGHTS.numberQuality;
  const first3 = subscriber.slice(0, 3);
  const last3 = subscriber.slice(-3);
  if (/^(\d)(\d)\1\2{3}\1$/.test(subscriber)) {
    return pattern(
      "interior_triple_rhythm",
      "Framed interior triple with full-number rhythm",
      nq.interiorTripleRhythm,
      "strong",
      "prefix",
      "interior_triple_rhythm",
    );
  }
  if (first3 === last3) {
    return pattern("repeated_prefix_line", `Repeated prefix and line block (${first3})`, nq.repeatedPrefixLine, "strong", "prefix", "repeated_prefix_line");
  }
  if (subscriber === reverseDigits(subscriber)) {
    return pattern("full_palindrome", "Full subscriber palindrome", nq.hiddenFullPalindrome, "medium", "prefix", "full_palindrome");
  }
  if (first3 === reverseDigits(last3)) {
    return pattern("mirrored_prefix_line", "Mirrored prefix and line digits", nq.mirroredPrefixLine, "medium", "prefix", "mirrored_prefix_line");
  }
  if (/^(\d)\1{2}$/.test(first3)) {
    return pattern("triple_prefix", `Triple exchange prefix (${first3})`, nq.triplePrefix, "weak", "prefix", "triple_prefix");
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

  if (/^(\d)\1{3}$/.test(last4)) points += 6;
  else if (/^(\d)(\d)\1\2$/.test(last4)) points += 5;
  else if (/^(\d)\1(\d)\2$/.test(last4) || /^(\d)(\d)\2\1$/.test(last4)) points += 4;

  const uniqueCount = new Set(subscriber.split("")).size;
  if (uniqueCount <= 2) points += 5;
  else if (uniqueCount === 3) points += 2;

  if (first3 === subscriber.slice(-3)) points += 4;

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

  const prefix = detectWholeNumberInteraction(subscriber);
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
