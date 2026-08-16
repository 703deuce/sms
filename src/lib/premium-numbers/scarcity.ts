import type { ScoredCandidate } from "./types";

const OBSERVATION_WINDOW_DAYS = 30;

/** Attach batch scarcity observations — does not affect pricing. */
export function attachScarcityObservations(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const today = new Date().toISOString().slice(0, 10);
  const byEnding = new Map<string, number>();
  const byPatternFamily = new Map<string, number>();

  for (const c of candidates) {
    const areaCode = c.rawDigits.slice(0, 3);
    const ending = c.subscriberDigits.slice(-4);
    const endingKey = `${areaCode}:${ending}`;
    byEnding.set(endingKey, (byEnding.get(endingKey) ?? 0) + 1);

    const primaryPattern = c.matchedPatterns[0] ?? "none";
    const patternKey = `${areaCode}:${primaryPattern}`;
    byPatternFamily.set(patternKey, (byPatternFamily.get(patternKey) ?? 0) + 1);
  }

  return candidates.map((c) => {
    const areaCode = c.rawDigits.slice(0, 3);
    const ending = c.subscriberDigits.slice(-4);
    const endingKey = `${areaCode}:${ending}`;
    const primaryWord = c.matchedWords[0];
    const patternFamily = c.matchedPatterns[0];

    return {
      ...c,
      scarcity: {
        exactComparableCount: byEnding.get(endingKey) ?? 1,
        patternFamilyComparableCount: byPatternFamily.get(
          `${areaCode}:${patternFamily ?? "none"}`,
        ) ?? 1,
        areaCode,
        observationDate: today,
        keyword: primaryWord,
        patternFamily,
        observationWindowDays: OBSERVATION_WINDOW_DAYS,
      },
    };
  });
}
