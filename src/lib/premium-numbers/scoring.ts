import type {
  KeywordEntry,
  ScoringReason,
  ScoredCandidate,
  ScoringSearchContext,
  TelnyxCost,
} from "./types";
import { commercialSemanticScoreForWords } from "./commercial-semantic";
import { formatUsPhone, parsePhoneDigits, splitUsLocalNumber, wordToKeypadDigits } from "./keypad";
import {
  detectNumericPatterns,
  simplicityScore,
} from "./pattern-detect";
import {
  blendScores,
  businessMatchToLabel,
  capDimension,
  numberQualityToLabel,
  SCORING_WEIGHTS,
  scoreToTier,
  THREE_LETTER_BUSINESS_MATCH_CAP,
} from "./scoring-config";

type WordPlacement = "exact_ending" | "beginning" | "interior" | "contains";

type WordMatch = {
  word: string;
  digits: string;
  placement: WordPlacement;
  digitLength: number;
  tier: KeywordEntry["tier"];
};

export function scoreCandidate(input: {
  phoneNumber: string;
  keywords: KeywordEntry[];
  telnyxCost?: TelnyxCost;
  rawTelnyx?: Record<string, unknown>;
  searchContext?: ScoringSearchContext;
  provider?: "telnyx" | "twilio";
  providerReference?: string | null;
}): ScoredCandidate | null {
  const digits10 = parsePhoneDigits(input.phoneNumber);
  const parts = splitUsLocalNumber(digits10);
  if (!parts) return null;

  const { subscriber, areaCode } = parts;
  const wordMatches = dedupeWordMatches(findWordMatches(subscriber, input.keywords), subscriber);
  const patterns = detectNumericPatterns(subscriber);

  const isBusinessContext = input.searchContext?.mode !== "personal";
  const business = isBusinessContext
    ? computeBusinessMatch(wordMatches, areaCode, input.searchContext)
    : { score: 0, reasons: [], localFitScore: 0, areaCodeMarketScore: 0 };
  const numberQuality = computeNumberQuality(
    subscriber,
    areaCode,
    patterns,
    providerCostSignals(input.telnyxCost, input.rawTelnyx),
  );
  const commercialSemanticScore = isBusinessContext
    ? capDimension(commercialSemanticScoreForWords(wordMatches.map((m) => m.word)))
    : 0;

  const personalMatchScore = input.searchContext?.mode === "personal"
    ? capDimension(computePersonalMatch(digits10, subscriber, input.searchContext))
    : undefined;

  const businessMatchScore = capDimension(business.score);
  const numberQualityScore = capDimension(numberQuality.score);
  const score = isBusinessContext
    ? blendScores(businessMatchScore, numberQualityScore)
    : capDimension(numberQualityScore * 0.8 + (personalMatchScore ?? 0) * 0.2);

  const providerSignals = providerCostSignals(input.telnyxCost, input.rawTelnyx);

  const reasons: ScoringReason[] = [...business.reasons, ...numberQuality.reasons];
  const matchedWords = [...new Set(wordMatches.map((m) => m.word))];
  const matchedPatterns = patterns.map((p) => p.label);

  return {
    phoneNumber: input.phoneNumber,
    formattedNumber: formatUsPhone(digits10),
    score,
    tier: scoreToTier(score),
    businessMatchScore,
    numberQualityScore,
    commercialSemanticScore,
    personalMatchScore,
    localFitScore: business.localFitScore,
    areaCodeMarketScore: business.areaCodeMarketScore,
    numberQualityLabel: numberQualityToLabel(numberQualityScore),
    businessFitLabel: businessMatchToLabel(businessMatchScore),
    matchedWords,
    matchedPatterns,
    reasons,
    businessReasons: business.reasons,
    numberQualityReasons: numberQuality.reasons,
    telnyxCost: input.telnyxCost,
    providerPremiumFlag: providerSignals.premiumFlag,
    providerCostPremiumSignal: providerSignals.costSignal,
    rawDigits: digits10,
    subscriberDigits: subscriber,
    rawTelnyx: input.rawTelnyx,
    provider: input.provider,
    providerReference: input.providerReference ?? null,
  };
}

function computeBusinessMatch(
  wordMatches: WordMatch[],
  areaCode: string,
  searchContext?: ScoringSearchContext,
): {
  score: number;
  reasons: ScoringReason[];
  localFitScore: number;
  areaCodeMarketScore: number;
} {
  const reasons: ScoringReason[] = [];
  let score = 0;
  const applied = new Set<string>();
  const explicitWords = new Set(
    (searchContext?.explicitKeywords ?? []).map((w) => w.trim().toUpperCase()),
  );

  for (const match of wordMatches) {
    const key = `${match.word}:${match.placement}`;
    if (applied.has(key)) continue;
    applied.add(key);

    const pts = businessWordPoints(match);
    if (pts <= 0) continue;
    score += pts;
    reasons.push({ label: wordMatchLabel(match), points: pts });

    const tierBonus = SCORING_WEIGHTS.businessMatch.tierBonus[match.tier];
    score += tierBonus;
    reasons.push({
      label: `${match.tier} industry keyword (${match.word})`,
      points: tierBonus,
    });

    const placementPts = placementBonus(match);
    if (placementPts > 0) {
      score += placementPts;
      reasons.push({ label: placementLabel(match), points: placementPts });
    }
  }

  for (const penalty of computeBusinessPenalties(wordMatches)) {
    score -= penalty.points;
    reasons.push({ label: penalty.label, points: -penalty.points });
  }

  const local = computeLocalFit(areaCode, searchContext?.requestedAreaCodes);
  const localFitScore = local.score;
  if (local.score > 0) {
    score += local.score;
    reasons.push({ label: local.label, points: local.score });
  }

  const areaCodeMarketScore = SCORING_WEIGHTS.businessMatch.areaCodeMarketDefault;

  const onlyShortWords =
    wordMatches.length > 0 && wordMatches.every((m) => m.digitLength === 3);
  const hasExplicitShort = wordMatches.some((m) => explicitWords.has(m.word));
  const hasStrongLong = wordMatches.some((m) => m.digitLength >= 4);

  if (
    onlyShortWords &&
    !hasExplicitShort &&
    !hasStrongLong &&
    score > THREE_LETTER_BUSINESS_MATCH_CAP
  ) {
    const capped = score - THREE_LETTER_BUSINESS_MATCH_CAP;
    score = THREE_LETTER_BUSINESS_MATCH_CAP;
    reasons.push({
      label: "Short accidental 3-letter match capped",
      points: -capped,
    });
  }

  return { score, reasons, localFitScore, areaCodeMarketScore };
}

function computeNumberQuality(
  subscriber: string,
  areaCode: string,
  patterns: ReturnType<typeof detectNumericPatterns>,
  providerSignals: { premiumFlag: boolean; costSignal: boolean },
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
    reasons.push({ label: "Digit simplicity (few unique digits)", points: simplicity });
  }

  const areaRelationship = computeAreaCodeRelationship(areaCode, subscriber);
  if (areaRelationship.points > 0) {
    score += areaRelationship.points;
    reasons.push(areaRelationship);
  }

  if (providerSignals.premiumFlag) {
    reasons.push({ label: "Provider premium flag", points: 0 });
  } else if (providerSignals.costSignal) {
    reasons.push({ label: "Provider cost signal", points: 0 });
  }

  return { score, reasons };
}

function computeAreaCodeRelationship(
  areaCode: string,
  subscriber: string,
): ScoringReason {
  const max = SCORING_WEIGHTS.numberQuality.areaCodeRelationshipMax;
  const exchange = subscriber.slice(0, 3);
  const lineEnd = subscriber.slice(-3);
  if (exchange === areaCode || lineEnd === areaCode) {
    return { label: "Local digits visibly repeat the area code", points: max };
  }
  if (exchange === areaCode.split("").reverse().join("")) {
    return { label: "Local exchange mirrors the area code", points: Math.max(1, max - 1) };
  }
  const rotations = [areaCode.slice(1) + areaCode[0], areaCode[2] + areaCode.slice(0, 2)];
  if (rotations.includes(exchange)) {
    return { label: "Local exchange complements the area code", points: Math.max(1, max - 2) };
  }
  return { label: "", points: 0 };
}

function providerCostSignals(
  telnyxCost?: TelnyxCost,
  rawTelnyx?: Record<string, unknown>,
): { premiumFlag: boolean; costSignal: boolean } {
  const monthly = Number(telnyxCost?.monthlyCost);
  const explicitPremium =
    rawTelnyx?.premium === true ||
    rawTelnyx?.is_premium === true ||
    rawTelnyx?.premium_number === true;
  const costSignal =
    Number.isFinite(monthly) &&
    monthly >= SCORING_WEIGHTS.providerCost.premiumThreshold;
  return { premiumFlag: explicitPremium, costSignal };
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
        placement: "exact_ending",
        digitLength: digits.length,
        tier: kw.tier,
      });
      continue;
    }

    if (subscriber.startsWith(digits)) {
      matches.push({
        word: kw.word,
        digits,
        placement: "beginning",
        digitLength: digits.length,
        tier: kw.tier,
      });
      continue;
    }

    const idx = subscriber.indexOf(digits);
    if (idx > 0 && idx + digits.length < subscriber.length) {
      matches.push({
        word: kw.word,
        digits,
        placement: "interior",
        digitLength: digits.length,
        tier: kw.tier,
      });
      continue;
    }

    if (idx >= 0 && idx + digits.length === subscriber.length) {
      matches.push({
        word: kw.word,
        digits,
        placement: "contains",
        digitLength: digits.length,
        tier: kw.tier,
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
  if (match.placement === "exact_ending" || match.placement === "beginning") {
    const table = bm.exactEndingBase;
    if (match.digitLength >= 7) return table.seven;
    if (match.digitLength === 6) return table.six;
    if (match.digitLength === 5) return table.five;
    if (match.digitLength === 4) return table.four;
    if (match.digitLength === 3) return table.three;
    return 0;
  }
  if (match.placement === "interior") {
    if (match.digitLength >= 6) return bm.containsBase.sixSeven;
    if (match.digitLength >= 4) return bm.containsBase.fourFive;
    if (match.digitLength === 3) return bm.containsBase.three;
  }
  if (match.digitLength >= 6) return bm.containsBase.sixSeven;
  if (match.digitLength >= 4) return bm.containsBase.fourFive;
  if (match.digitLength === 3) return bm.containsBase.three;
  return 0;
}

function placementBonus(match: WordMatch): number {
  const pb = SCORING_WEIGHTS.businessMatch.placementBonus;
  if (match.placement === "exact_ending") {
    return match.digitLength >= 4 ? pb.exactEnding + pb.cleanEnding : pb.exactEnding;
  }
  if (match.placement === "beginning") return pb.beginning;
  if (match.placement === "interior") return pb.interior;
  return 0;
}

function placementLabel(match: WordMatch): string {
  if (match.placement === "exact_ending") {
    return match.digitLength >= 4
      ? "Word cleanly ends subscriber number"
      : "Keyword ends subscriber number";
  }
  if (match.placement === "beginning") return "Keyword starts subscriber number";
  if (match.placement === "interior") return "Keyword embedded in subscriber number";
  return "Keyword contained in number";
}

function wordMatchLabel(match: WordMatch): string {
  const lenLabel =
    match.digitLength >= 7
      ? "7-letter"
      : match.digitLength === 6
        ? "6-letter"
        : match.digitLength === 5
          ? "5-letter"
          : match.digitLength === 4
            ? "4-letter"
            : "3-letter";
  if (match.placement === "exact_ending") {
    return `Exact ${lenLabel} commercial word: ${match.word}`;
  }
  return `Matched ${lenLabel} word: ${match.word}`;
}

function computeBusinessPenalties(matches: WordMatch[]): ScoringReason[] {
  const penalties: ScoringReason[] = [];
  if (!matches.length) return penalties;

  for (const match of matches) {
    if (match.placement === "interior" && match.digitLength <= 3) {
      penalties.push({
        label: `Short accidental ${match.digitLength}-letter match (${match.word})`,
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
    matches.every((m) => m.digitLength <= 3 || m.placement === "interior") &&
    matches.length > 0;
  if (onlyWeak) {
    penalties.push({
      label: "Only weak keyword signal",
      points: SCORING_WEIGHTS.penalties.weakKeywordOnly,
    });
  }

  return penalties;
}

function computeLocalFit(
  areaCode: string,
  requestedAreaCodes?: string[],
): { score: number; label: string } {
  if (!requestedAreaCodes?.length) return { score: 0, label: "" };
  const allowed = new Set(requestedAreaCodes.map((c) => c.replace(/\D/g, "").slice(0, 3)));
  if (!allowed.has(areaCode)) return { score: 0, label: "" };
  const max = SCORING_WEIGHTS.businessMatch.localFitMax;
  return {
    score: max,
    label: `Requested ${areaCode} area code`,
  };
}

function computePersonalMatch(
  digits10: string,
  subscriber: string,
  searchContext: ScoringSearchContext,
): number {
  const prefs = searchContext.personalPreferences;
  let score = 0;
  const areaCode = digits10.slice(0, 3);

  const requestedAreaCodes = prefs?.requestedAreaCodes ?? searchContext.requestedAreaCodes;
  if (requestedAreaCodes?.includes(areaCode)) score += 10;

  for (const ending of prefs?.requestedEndingDigits ?? []) {
    if (subscriber.endsWith(ending)) score += 20;
  }

  for (const fav of prefs?.favoriteDigits ?? []) {
    if (subscriber.includes(fav)) score += 10;
  }

  for (const date of [...(prefs?.birthdayDigits ?? []), ...(prefs?.anniversaryDigits ?? [])]) {
    if (subscriber.includes(date)) score += 15;
  }

  for (const token of prefs?.nameTokens ?? []) {
    const digits = /\D/.test(token) ? wordToKeypadDigits(token) : token.replace(/\D/g, "");
    if (digits.length >= 3 && subscriber.includes(digits)) score += 12;
  }

  return Math.min(100, score);
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
