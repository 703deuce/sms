import { buildKeywordEntries } from "./industry-keywords";
import { scoreCandidate, sortCandidates } from "./scoring";
import { SCORING_WEIGHTS } from "./scoring-config";
import { runTelnyxInventorySearches } from "./telnyx-inventory-search";
import { parsePhoneDigits } from "./keypad";
import type { PremiumSearchResult, ScoredCandidate } from "./types";

export type PersonalPreference =
  | "repeating_digits"
  | "ends_0000"
  | "easy_sequence"
  | "repeating_pair"
  | "very_memorable"
  | "surprise_me";

const PREFERENCE_PATTERNS: Record<PersonalPreference, string[]> = {
  repeating_digits: ["1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999"],
  ends_0000: ["0000", "1000", "2000", "5000"],
  easy_sequence: ["1234", "4321", "5678", "8765"],
  repeating_pair: ["1212", "1313", "2020", "2323", "2525"],
  very_memorable: [
    "1111",
    "2222",
    "3333",
    "4444",
    "5555",
    "6666",
    "7777",
    "8888",
    "9999",
    "0000",
    "1234",
    "4321",
    "1212",
  ],
  surprise_me: [...SCORING_WEIGHTS.memorablePatternSearchDigits],
};

function patternsForPreferences(preferences: PersonalPreference[]): string[] {
  if (!preferences.length || preferences.includes("surprise_me")) {
    return [...SCORING_WEIGHTS.memorablePatternSearchDigits];
  }
  const set = new Set<string>();
  for (const pref of preferences) {
    for (const p of PREFERENCE_PATTERNS[pref]) set.add(p);
  }
  return [...set];
}

function sortPersonalCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.numberQualityScore !== a.numberQualityScore) {
      return b.numberQualityScore - a.numberQualityScore;
    }
    if (b.score !== a.score) return b.score - a.score;
    return a.formattedNumber.localeCompare(b.formattedNumber);
  });
}

/**
 * Personal memorable-number search — no industry keywords; ranks by number quality.
 * Reuses Telnyx inventory + scoring engine without duplicating logic.
 */
export async function searchPremiumNumbersPersonal(input: {
  areaCode: string;
  areaCodes?: string[];
  preferences?: PersonalPreference[];
  limit?: number;
}): Promise<PremiumSearchResult> {
  const areaCodes =
    input.areaCodes?.length
      ? [...new Set(input.areaCodes.map((c) => c.replace(/\D/g, "").slice(0, 3)).filter((c) => c.length === 3))]
      : [input.areaCode.replace(/\D/g, "").slice(0, 3)];

  const primaryAreaCode = areaCodes[0] ?? "";
  if (!areaCodes.length || areaCodes.some((c) => c.length !== 3)) {
    return {
      status: "NOT_CONFIGURED",
      areaCode: primaryAreaCode,
      keywords: [],
      candidates: [],
      statistics: emptyStats(),
      searchAttempts: [],
      message: "At least one valid 3-digit area code is required",
    };
  }

  const keywords = buildKeywordEntries({});
  const memorablePatterns = patternsForPreferences(input.preferences ?? ["surprise_me"]);

  let allCandidates: Awaited<ReturnType<typeof runTelnyxInventorySearches>>["candidates"] = [];
  const attempts: PremiumSearchResult["searchAttempts"] = [];

  try {
    for (const areaCode of areaCodes) {
      const inventory = await runTelnyxInventorySearches({
        areaCode,
        keywordDigitStrings: [],
        memorablePatterns,
        baseLimit: areaCodes.length > 1 ? 30 : 50,
      });
      attempts.push(...inventory.attempts);
      const filtered = inventory.candidates.filter((c) => {
        const digits = parsePhoneDigits(c.phoneNumber);
        return digits.length === 10 && digits.startsWith(areaCode);
      });
      allCandidates.push(...filtered);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: /not configured|TELNYX_API_KEY/i.test(message) ? "NOT_CONFIGURED" : "TELNYX_ERROR",
      areaCode: primaryAreaCode,
      keywords: [],
      candidates: [],
      statistics: emptyStats(),
      searchAttempts: [],
      message,
    };
  }

  const byPhone = new Map<string, Awaited<ReturnType<typeof runTelnyxInventorySearches>>["candidates"][0]>();
  for (const c of allCandidates) {
    if (!byPhone.has(c.phoneNumber)) byPhone.set(c.phoneNumber, c);
  }
  allCandidates = [...byPhone.values()];

  const scored = allCandidates
    .map((raw) =>
      scoreCandidate({
        phoneNumber: raw.phoneNumber,
        keywords,
        telnyxCost:
          raw.monthlyCost || raw.upfrontCost
            ? {
                upfrontCost: raw.upfrontCost,
                monthlyCost: raw.monthlyCost,
                currency: raw.currency,
              }
            : undefined,
        rawTelnyx: raw.raw,
      }),
    )
    .filter((c): c is ScoredCandidate => c !== null);

  const sorted = sortPersonalCandidates(scored);
  const limit = input.limit ?? 100;
  const candidates = sorted.slice(0, limit);

  const hadInventory = allCandidates.length > 0;
  const status =
    !hadInventory
      ? "NO_INVENTORY"
      : candidates.some((c) => c.numberQualityScore >= 55)
        ? "RESULTS_FOUND"
        : candidates.length
          ? "RESULTS_FOUND_BUT_NONE_PREMIUM"
          : "NO_INVENTORY";

  const statistics = buildStats(sorted, attempts, allCandidates.length);

  return {
    status,
    areaCode: primaryAreaCode,
    keywords,
    candidates,
    statistics,
    searchAttempts: attempts,
  };
}

function emptyStats() {
  return {
    telnyxSearchesAttempted: 0,
    telnyxSearchesSucceeded: 0,
    telnyxSearchesFailed: 0,
    rawCandidates: 0,
    uniqueCandidates: 0,
    scored60Plus: 0,
    scored70Plus: 0,
    scored80Plus: 0,
    scored90Plus: 0,
    highestScore: 0,
    averageScore: 0,
    matchedKeywords: [],
    tierCounts: {
      Exceptional: 0,
      Premium: 0,
      Excellent: 0,
      Good: 0,
      Nice: 0,
      Ordinary: 0,
    },
  };
}

function buildStats(
  sorted: ScoredCandidate[],
  attempts: PremiumSearchResult["searchAttempts"],
  rawCount: number,
) {
  const stats = emptyStats();
  stats.telnyxSearchesAttempted = attempts.length;
  stats.telnyxSearchesSucceeded = attempts.filter((a) => a.status === "ok").length;
  stats.telnyxSearchesFailed = attempts.filter((a) => a.status !== "ok").length;
  stats.rawCandidates = rawCount;
  stats.uniqueCandidates = sorted.length;
  let sum = 0;
  for (const c of sorted) {
    sum += c.numberQualityScore;
    if (c.numberQualityScore >= 60) stats.scored60Plus += 1;
    if (c.numberQualityScore >= 70) stats.scored70Plus += 1;
    if (c.numberQualityScore >= 80) stats.scored80Plus += 1;
    if (c.numberQualityScore >= 90) stats.scored90Plus += 1;
    stats.highestScore = Math.max(stats.highestScore, c.numberQualityScore);
    stats.tierCounts[c.tier] += 1;
  }
  stats.averageScore = sorted.length ? Math.round((sum / sorted.length) * 10) / 10 : 0;
  return stats;
}
