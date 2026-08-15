import { SCORING_WEIGHTS } from "./scoring-config";

export type DetectedPattern = {
  id: string;
  label: string;
  points: number;
  strength: "strong" | "medium" | "weak";
};

export function detectNumericPatterns(subscriber: string): DetectedPattern[] {
  if (subscriber.length !== 7) return [];
  const patterns: DetectedPattern[] = [];
  const last4 = subscriber.slice(-4);
  const last3 = subscriber.slice(-3);
  const first3 = subscriber.slice(0, 3);

  if (/^(\d)\1{3}$/.test(last4)) {
    patterns.push({
      id: "last4_identical",
      label: `Last four identical (${last4})`,
      points: SCORING_WEIGHTS.pattern.last4Identical,
      strength: "strong",
    });
  } else if (/^(\d)\1{2}$/.test(last3)) {
    patterns.push({
      id: "last3_identical",
      label: `Last three identical (${last3})`,
      points: SCORING_WEIGHTS.pattern.last3Identical,
      strength: "medium",
    });
  }

  if (last4 === "0000") {
    patterns.push({
      id: "ends_0000",
      label: "Ends in 0000",
      points: SCORING_WEIGHTS.pattern.ends0000,
      strength: "strong",
    });
  } else if (/000$/.test(subscriber)) {
    patterns.push({
      id: "ends_x000",
      label: "Ends in X000",
      points: SCORING_WEIGHTS.pattern.endsX000,
      strength: "medium",
    });
  }

  if (/^(\d{2})\1$/.test(last4)) {
    patterns.push({
      id: "repeated_pair",
      label: `Repeated pair (${last4})`,
      points: SCORING_WEIGHTS.pattern.repeatedPair,
      strength: "strong",
    });
  }

  if (last4 === "1234" || last4 === "4321") {
    patterns.push({
      id: "sequence",
      label: `Sequence (${last4})`,
      points: SCORING_WEIGHTS.pattern.sequence,
      strength: "strong",
    });
  }

  if (/^(\d)\1{2}/.test(first3)) {
    patterns.push({
      id: "triple_prefix",
      label: `Triple repeating prefix (${first3})`,
      points: SCORING_WEIGHTS.pattern.triplePrefix,
      strength: "medium",
    });
  }

  if (subscriber === reverseDigits(subscriber)) {
    patterns.push({
      id: "palindrome_full",
      label: "Full subscriber palindrome",
      points: SCORING_WEIGHTS.pattern.palindromeStrong,
      strength: "strong",
    });
  } else if (last4 === reverseDigits(last4)) {
    patterns.push({
      id: "palindrome_last4",
      label: `Palindrome last four (${last4})`,
      points: SCORING_WEIGHTS.pattern.palindromeWeak,
      strength: "medium",
    });
  }

  if (/^(\d)(\d)\1\2$/.test(last4)) {
    patterns.push({
      id: "abab",
      label: `ABAB pattern (${last4})`,
      points: SCORING_WEIGHTS.pattern.abab,
      strength: "medium",
    });
  }

  return dedupePatterns(patterns);
}

function reverseDigits(s: string): string {
  return s.split("").reverse().join("");
}

function dedupePatterns(patterns: DetectedPattern[]): DetectedPattern[] {
  const seen = new Set<string>();
  const out: DetectedPattern[] = [];
  for (const p of patterns) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export function simplicityScore(subscriber: string): number {
  const unique = new Set(subscriber.split(""));
  if (unique.size <= 2) return SCORING_WEIGHTS.combination.exceptionalSimplicity;
  if (unique.size === 3) return 3;
  return 0;
}
