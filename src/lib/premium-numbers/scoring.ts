import type { KeywordEntry, ScoringReason, ScoredCandidate, TelnyxCost } from "./types";
import { formatUsPhone, parsePhoneDigits, splitUsLocalNumber } from "./keypad";
import { detectNumericPatterns, simplicityScore } from "./pattern-detect";
import {
  blendScores,
  capDimension,
  SCORING_WEIGHTS,
  scoreToTier,
} from "./scoring-config";

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
  const wordMatches = dedupeWordMatches(findWordMatches(subscriber, input.keywords), subscriber);
  const patterns = detectNumericPatterns(subscriber);

  const business = computeBusinessMatch(wordMatches);
  const numberQuality = computeNumberQuality(
    subscriber,
    patterns,
    wordMatches,
    input.telnyxCost,
  );

  const businessMatchScore = capDimension(business.score);
  const numberQualityScore = capDimension(numberQuality.score);
  const score = blendScores(businessMatchScore, numberQualityScore);

  const reasons: ScoringReason[] = [
    ...business.reasons,
    ...numberQuality.reasons,
  ];

  const matchedWords = [...new Set(wordMatches.map((m) => m.word))];
  const matchedPatterns = patterns.map((p) => p.label);

  return {
    phoneNumber: input.phoneNumber,
    formattedNumber: formatUsPhone(digits10),
    score,
    tier: scoreToTier(score),
    businessMatchScore,
    numberQualityScore,
    matchedWords,
    matchedPatterns,
    reasons,
    businessReasons: business.reasons,
    numberQualityReasons: numberQuality.reasons,
    telnyxCost: input.telnyxCost,
    rawDigits: digits10,
    subscriberDigits: subscriber,
    rawTelnyx: input.rawTelnyx,
  };
}

function computeBusinessMatch(wordMatches: WordMatch[]): {
  score: number;
  reasons: ScoringReason[];
} {
  const reasons: ScoringReason[] = [];
  let score = 0;
  const applied = new Set<string>();

  for (const match of wordMatches) {
    const key = `${match.word}:${match.kind}`;
    if (applied.has(key)) continue;
    applied.add(key);

    const pts = businessWordPoints(match);
    if (pts <= 0) continue;
    score += pts;
    reasons.push({ label: wordMatchLabel(match), points: pts });

    if (match.kind === "exact_ending" && match.isPrimary && match.digitLength >= 4) {
      score += SCORING_WEIGHTS.businessMatch.cleanPlacementBonus;
      reasons.push({
        label: "Clean exact industry word placement",
        points: SCORING_WEIGHTS.businessMatch.cleanPlacementBonus,
      });
    }

    if (match.isPrimary) {
      score += SCORING_WEIGHTS.businessMatch.industryPrimaryBonus;
      reasons.push({
        label: "Primary industry match",
        points: SCORING_WEIGHTS.businessMatch.industryPrimaryBonus,
      });
    } else if (match.isSecondary) {
      score += SCORING_WEIGHTS.businessMatch.industrySecondaryBonus;
      reasons.push({
        label: "Secondary industry synonym",
        points: SCORING_WEIGHTS.businessMatch.industrySecondaryBonus,
      });
    }
  }

  for (const penalty of computeBusinessPenalties(wordMatches)) {
    score -= penalty.points;
    reasons.push({ label: penalty.label, points: -penalty.points });
  }

  return { score, reasons };
}

function computeNumberQuality(
  subscriber: string,
  patterns: ReturnType<typeof detectNumericPatterns>,
  wordMatches: WordMatch[],
  telnyxCost?: TelnyxCost,
): { score: number; reasons: ScoringReason[] } {
  const reasons: ScoringReason[] = [];
  let score = 0;

  for (const pattern of patterns) {
    score += pattern.points;
    reasons.push({ label: pattern.label, points: pattern.points });
  }

  const simplicity = simplicityScore(subscriber);
  if (simplicity > 0) {
    score += simplicity;
    reasons.push({ label: "High overall numeric simplicity", points: simplicity });
  }

  const providerBonus = providerCostBonus(telnyxCost);
  if (providerBonus.points > 0) {
    score += providerBonus.points;
    reasons.push({ label: providerBonus.label, points: providerBonus.points });
  }

  const strongWord = wordMatches.some(
    (m) => m.kind === "exact_ending" && m.digitLength >= 4 && m.isPrimary,
  );
  const hasIndependentNumeric = patterns.some(
    (p) => p.family === "prefix" || p.family === "full" || p.strength === "strong",
  );
  if (strongWord && hasIndependentNumeric) {
    score += SCORING_WEIGHTS.numberQuality.wordPlusNumericBoost;
    reasons.push({
      label: "Memorable numeric portion enhances industry word",
      points: SCORING_WEIGHTS.numberQuality.wordPlusNumericBoost,
    });
  }

  return { score, reasons };
}

function providerCostBonus(telnyxCost?: TelnyxCost): { points: number; label: string } {
  const monthly = Number(telnyxCost?.monthlyCost);
  if (!Number.isFinite(monthly)) return { points: 0, label: "" };
  const { baselineMonthly, premiumThreshold, highPremiumThreshold, premiumBonus, highPremiumBonus } =
    SCORING_WEIGHTS.providerCost;
  if (monthly >= highPremiumThreshold) {
    return {
      points: highPremiumBonus,
      label: "Provider marks this number as premium inventory",
    };
  }
  if (monthly >= premiumThreshold || monthly > baselineMonthly) {
    return {
      points: premiumBonus,
      label: "Provider marks this number as premium inventory",
    };
  }
  return { points: 0, label: "" };
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

function dedupeWordMatches(matches: WordMatch[], subscriber: string): WordMatch[] {
  const sorted = [...matches].sort((a, b) => b.digitLength - a.digitLength);
  const kept: WordMatch[] = [];
  for (const m of sorted) {
    const subsumed = kept.some(
      (k) =>
        k.digitLength > m.digitLength &&
        k.digits.includes(m.digits) &&
        subscriber.includes(k.digits),
    );
    if (!subsumed) kept.push(m);
  }
  return kept;
}

function businessWordPoints(match: WordMatch): number {
  const bm = SCORING_WEIGHTS.businessMatch;
  if (match.kind === "exact_ending") {
    const table = match.isPrimary ? bm.exactEndingPrimary : bm.exactEndingSecondary;
    if (match.digitLength >= 7) return table.seven;
    if (match.digitLength === 6) return table.six;
    if (match.digitLength === 5) return table.five;
    if (match.digitLength === 4) return table.four;
    if (match.digitLength === 3) return table.three;
    return 0;
  }
  if (match.digitLength >= 6) return bm.contains.sixSeven;
  if (match.digitLength >= 4) return bm.contains.fourFive;
  if (match.digitLength === 3) return bm.contains.three;
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

function computeBusinessPenalties(matches: WordMatch[]): ScoringReason[] {
  const penalties: ScoringReason[] = [];
  if (!matches.length) return penalties;

  for (const match of matches) {
    if (match.kind === "contains" && match.digitLength <= 3) {
      penalties.push({
        label: `Short accidental ${match.digitLength}-digit match (${match.word})`,
        points: SCORING_WEIGHTS.penalties.shortAccidental,
      });
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

  return penalties;
}

export function sortCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.businessMatchScore !== a.businessMatchScore) {
      return b.businessMatchScore - a.businessMatchScore;
    }
    return a.formattedNumber.localeCompare(b.formattedNumber);
  });
}
