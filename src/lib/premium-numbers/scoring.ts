import type { KeywordEntry, ScoringReason, ScoredCandidate, TelnyxCost } from "./types";
import { formatUsPhone, parsePhoneDigits, splitUsLocalNumber } from "./keypad";
import { detectNumericPatterns, simplicityScore } from "./pattern-detect";
import { SCORING_WEIGHTS, scoreToTier } from "./scoring-config";

type WordMatch = {
  word: string;
  digits: string;
  kind: "exact_ending" | "contains";
  digitLength: number;
  isPrimary: boolean;
  isSecondary: boolean;
};

export function scoreCandidate(input: {
  phoneNumber: string;
  keywords: KeywordEntry[];
  telnyxCost?: TelnyxCost;
  rawTelnyx?: Record<string, unknown>;
}): ScoredCandidate | null {
  const digits10 = parsePhoneDigits(input.phoneNumber);
  const parts = splitUsLocalNumber(digits10);
  if (!parts) return null;

  const { subscriber } = parts;
  const wordMatches = findWordMatches(subscriber, input.keywords);
  const patterns = detectNumericPatterns(subscriber);
  const reasons: ScoringReason[] = [];
  let score = 0;

  const appliedWordKeys = new Set<string>();
  for (const match of wordMatches) {
    const key = `${match.word}:${match.kind}`;
    if (appliedWordKeys.has(key)) continue;
    appliedWordKeys.add(key);

    const pts = wordMatchPoints(match);
    if (pts <= 0) continue;
    score += pts;
    reasons.push({
      label: wordMatchLabel(match),
      points: pts,
    });

    if (match.isPrimary) {
      score += SCORING_WEIGHTS.word.industryPrimary;
      reasons.push({
        label: "Primary industry match",
        points: SCORING_WEIGHTS.word.industryPrimary,
      });
    } else if (match.isSecondary) {
      score += SCORING_WEIGHTS.word.industrySecondary;
      reasons.push({
        label: "Secondary industry synonym",
        points: SCORING_WEIGHTS.word.industrySecondary,
      });
    }
  }

  const appliedPatternIds = new Set<string>();
  for (const pattern of patterns) {
    if (appliedPatternIds.has(pattern.id)) continue;
    appliedPatternIds.add(pattern.id);
    score += pattern.points;
    reasons.push({ label: pattern.label, points: pattern.points });
  }

  const strongWord = wordMatches.some(
    (m) => m.kind === "exact_ending" && m.digitLength >= 4,
  );
  const strongPattern = patterns.some((p) => p.strength === "strong");
  if (strongWord && strongPattern) {
    score += SCORING_WEIGHTS.combination.strongWordAndPattern;
    reasons.push({
      label: "Strong keyword + numeric pattern combination",
      points: SCORING_WEIGHTS.combination.strongWordAndPattern,
    });
  }

  const simplicity = simplicityScore(subscriber);
  if (simplicity > 0) {
    score += simplicity;
    reasons.push({
      label: "High overall simplicity",
      points: simplicity,
    });
  }

  const penalties = computePenalties(subscriber, wordMatches);
  for (const penalty of penalties) {
    score -= penalty.points;
    reasons.push({ label: penalty.label, points: -penalty.points });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const matchedWords = [...new Set(wordMatches.map((m) => m.word))];
  const matchedPatterns = patterns.map((p) => p.label);

  return {
    phoneNumber: input.phoneNumber,
    formattedNumber: formatUsPhone(digits10),
    score,
    tier: scoreToTier(score),
    matchedWords,
    matchedPatterns,
    reasons,
    telnyxCost: input.telnyxCost,
    rawDigits: digits10,
    subscriberDigits: subscriber,
    rawTelnyx: input.rawTelnyx,
  };
}

function findWordMatches(subscriber: string, keywords: KeywordEntry[]): WordMatch[] {
  const matches: WordMatch[] = [];
  for (const kw of keywords) {
    const digits = kw.digits;
    if (digits.length < 3) continue;

    if (subscriber.endsWith(digits)) {
      matches.push({
        word: kw.word,
        digits,
        kind: "exact_ending",
        digitLength: digits.length,
        isPrimary: kw.isPrimary,
        isSecondary: kw.isSecondary,
      });
      continue;
    }

    const idx = subscriber.indexOf(digits);
    if (idx >= 0 && idx + digits.length < subscriber.length) {
      matches.push({
        word: kw.word,
        digits,
        kind: "contains",
        digitLength: digits.length,
        isPrimary: kw.isPrimary,
        isSecondary: kw.isSecondary,
      });
    }
  }
  return matches;
}

function wordMatchPoints(match: WordMatch): number {
  if (match.kind === "exact_ending") {
    if (match.digitLength >= 7) return SCORING_WEIGHTS.word.exactEnding.seven;
    if (match.digitLength === 6) return SCORING_WEIGHTS.word.exactEnding.six;
    if (match.digitLength === 5) return SCORING_WEIGHTS.word.exactEnding.five;
    if (match.digitLength === 4) return SCORING_WEIGHTS.word.exactEnding.four;
    if (match.digitLength === 3) return SCORING_WEIGHTS.word.exactEnding.three;
    return 0;
  }
  if (match.digitLength >= 6) return SCORING_WEIGHTS.word.contains.sixSeven;
  if (match.digitLength >= 4) return SCORING_WEIGHTS.word.contains.fourFive;
  if (match.digitLength === 3) return SCORING_WEIGHTS.word.contains.three;
  return 0;
}

function wordMatchLabel(match: WordMatch): string {
  const lenLabel =
    match.digitLength >= 7
      ? "7-digit"
      : match.digitLength === 6
        ? "6-digit"
        : match.digitLength === 5
          ? "5-digit"
          : match.digitLength === 4
            ? "4-digit"
            : "3-digit";
  if (match.kind === "exact_ending") {
    return `Exact ${lenLabel} keyword ending (${match.word} → ${match.digits})`;
  }
  return `Keyword contained (${match.word} → ${match.digits})`;
}

function computePenalties(
  subscriber: string,
  matches: WordMatch[],
): ScoringReason[] {
  const penalties: ScoringReason[] = [];
  if (!matches.length) return penalties;

  for (const match of matches) {
    if (match.kind === "contains" && match.digitLength <= 3) {
      penalties.push({
        label: `Short accidental ${match.digitLength}-digit match (${match.word})`,
        points: SCORING_WEIGHTS.penalties.shortAccidental,
      });
    }

    if (match.kind === "contains") {
      const idx = subscriber.indexOf(match.digits);
      const endsAt = idx + match.digits.length;
      const nxx = subscriber.slice(0, 3);
      const xxxx = subscriber.slice(3);
      const crossesBoundary =
        idx < 3 && endsAt > 3 && !(idx === 0 && endsAt === subscriber.length);
      if (crossesBoundary && match.digitLength < 5) {
        penalties.push({
          label: `Keyword awkwardly split across ${nxx}-${xxxx}`,
          points: SCORING_WEIGHTS.penalties.awkwardPosition,
        });
      }
    }
  }

  const distinctWords = new Set(matches.map((m) => m.word));
  if (distinctWords.size >= 3) {
    penalties.push({
      label: "Multiple competing keyword interpretations",
      points: SCORING_WEIGHTS.penalties.conflictingInterpretations,
    });
  }

  const onlyWeak =
    matches.every((m) => m.digitLength <= 3 || m.kind === "contains") &&
    matches.length > 0;
  if (onlyWeak) {
    penalties.push({
      label: "Only weak keyword signal",
      points: SCORING_WEIGHTS.penalties.weakKeywordOnly,
    });
  }

  const uniqueDigits = new Set(subscriber.split("")).size;
  if (uniqueDigits >= 6 && matches.length === 1 && matches[0].digitLength <= 4) {
    penalties.push({
      label: "Random-looking number despite weak keyword hit",
      points: SCORING_WEIGHTS.penalties.hardToRemember,
    });
  }

  return penalties;
}

export function sortCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.formattedNumber.localeCompare(b.formattedNumber);
  });
}
