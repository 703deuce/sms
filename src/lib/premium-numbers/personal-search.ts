import { buildKeywordEntries } from "./industry-keywords";
import { scoreCandidate } from "./scoring";
import { SCORING_WEIGHTS } from "./scoring-config";
import { quotePremiumPrice } from "./premium-pricing";
import { runCombinedInventorySearches } from "./combined-inventory-search";
import { parsePhoneDigits } from "./keypad";
import type { ProviderSearchAttempt } from "@/lib/numbers/providers/types";
import type { NumberUpstreamProvider } from "@/lib/numbers/providers/types";
import type { PremiumSearchResult, ScoredCandidate, TelnyxSearchAttempt } from "./types";

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

function mapProviderAttemptStatus(
  status: ProviderSearchAttempt["status"],
): TelnyxSearchAttempt["status"] {
  if (status === "ok") return "ok";
  if (status === "unsupported") return "unsupported";
  return "error";
}

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
    const rank = (candidate: ScoredCandidate) => {
      const price = quotePremiumPrice(candidate, "personal").premiumPriceCents;
      const affordability =
        price <= 499 ? 15 : price <= 799 ? 12 : price <= 999 ? 10 : price <= 1499 ? 7 : price <= 1999 ? 3 : 0;
      return candidate.numberQualityScore * 0.4 + (candidate.personalMatchScore ?? 0) * 0.45 + affordability;
    };
    const rankDelta = rank(b) - rank(a);
    if (rankDelta !== 0) return rankDelta;
    if (b.numberQualityScore !== a.numberQualityScore) return b.numberQualityScore - a.numberQualityScore;
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
}, options?: {
  onProgress?: (progress: {
    candidates: ScoredCandidate[];
    status: PremiumSearchResult["status"];
    pendingProviders: NumberUpstreamProvider[];
    completedProviders: NumberUpstreamProvider[];
    currentAreaCode: string;
    providerAttempts: ProviderSearchAttempt[];
    inventoryScannedCount: number;
  }) => void;
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

  let allCandidates: Awaited<ReturnType<typeof runCombinedInventorySearches>>["candidates"] = [];
  const attempts: PremiumSearchResult["searchAttempts"] = [];
  const providerAttempts: ProviderSearchAttempt[] = [];
  const completedProviders = new Set<NumberUpstreamProvider>();
  const limit = input.limit ?? 100;

  const emitProgress = (pendingProviders: NumberUpstreamProvider[], currentAreaCode: string) => {
    if (!options?.onProgress) return;
    const byPhone = new Map<string, Awaited<ReturnType<typeof runCombinedInventorySearches>>["candidates"][0]>();
    for (const c of allCandidates) {
      if (!byPhone.has(c.phoneNumber)) byPhone.set(c.phoneNumber, c);
    }
    const merged = [...byPhone.values()];
    const scored = merged
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
          provider: raw.provider,
          providerReference: raw.providerReference,
          searchContext: { mode: "personal", requestedAreaCodes: areaCodes },
        }),
      )
      .filter((c): c is ScoredCandidate => c !== null);
    const sorted = sortPersonalCandidates(scored);
    const ranked = sorted.slice(0, limit);
    const hadInventory = merged.length > 0;
    const status =
      !hadInventory
        ? "NO_INVENTORY"
        : ranked.some((c) => c.numberQualityScore >= 55)
          ? "RESULTS_FOUND"
          : ranked.length
            ? "RESULTS_FOUND_BUT_NONE_PREMIUM"
            : "NO_INVENTORY";
    options.onProgress({
      candidates: ranked,
      status,
      pendingProviders,
      completedProviders: [...completedProviders],
      currentAreaCode,
      providerAttempts: [...providerAttempts],
      inventoryScannedCount: merged.length,
    });
  };

  try {
    for (const areaCode of areaCodes) {
      await runCombinedInventorySearches(
        {
          areaCode,
          keywordDigitStrings: [],
          memorablePatterns,
          baseLimit: areaCodes.length > 1 ? 30 : 50,
        },
        {
          onProgress: ({ batch, candidates, attempts: batchAttempts }) => {
            completedProviders.add(batch.provider);
            providerAttempts.push(...batchAttempts);
            attempts.push(
              ...batchAttempts.map((a) => ({
                provider: a.provider,
                areaCode: batch.areaCode,
                strategy: a.strategy,
                query: {},
                status: mapProviderAttemptStatus(a.status),
                error: a.error,
                resultCount: a.resultCount ?? 0,
              })),
            );
            const filtered = candidates.filter((c) => {
              const digits = parsePhoneDigits(c.phoneNumber);
              return digits.length === 10 && digits.startsWith(areaCode);
            });
            allCandidates.push(...filtered);
            emitProgress(batch.pendingProviders, batch.areaCode);
          },
        },
      );
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

  const byPhone = new Map<string, Awaited<ReturnType<typeof runCombinedInventorySearches>>["candidates"][0]>();
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
        provider: raw.provider,
        providerReference: raw.providerReference,
        searchContext: { mode: "personal", requestedAreaCodes: areaCodes },
      }),
    )
    .filter((c): c is ScoredCandidate => c !== null);

  const sorted = sortPersonalCandidates(scored);
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
    providerAttempts,
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
