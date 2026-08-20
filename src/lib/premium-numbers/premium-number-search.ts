import { inferIndustryFromText } from "./business-name-keywords";
import { buildKeywordEntries } from "./industry-keywords";
import { parsePhoneDigits } from "./keypad";
import { scoreCandidate, sortCandidates } from "./scoring";
import { attachScarcityObservations } from "./scarcity";
import { SCORING_WEIGHTS } from "./scoring-config";
import { runCombinedInventorySearches } from "./combined-inventory-search";
import type { InventoryCandidateForScoring } from "@/lib/numbers/providers/inventory-bridge";
import type { ProviderSearchAttempt } from "@/lib/numbers/providers/types";
import type { NumberUpstreamProvider } from "@/lib/numbers/providers/types";
import type {
  PremiumSearchInput,
  PremiumSearchResult,
  PremiumSearchStatistics,
  PremiumSearchStatus,
  QualityTier,
  TelnyxCost,
  TelnyxSearchAttempt,
} from "./types";

function emptyTierCounts(): Record<QualityTier, number> {
  return {
    Exceptional: 0,
    Premium: 0,
    Excellent: 0,
    Good: 0,
    Nice: 0,
    Ordinary: 0,
  };
}

function buildStatistics(candidates: ReturnType<typeof sortCandidates>): PremiumSearchStatistics {
  const tierCounts = emptyTierCounts();
  let sum = 0;
  let highest = 0;
  const matchedKeywords = new Set<string>();

  for (const c of candidates) {
    tierCounts[c.tier] += 1;
    sum += c.score;
    highest = Math.max(highest, c.score);
    for (const w of c.matchedWords) matchedKeywords.add(w);
  }

  const count = candidates.length;
  const averageScore = count ? Math.round((sum / count) * 10) / 10 : 0;

  return {
    telnyxSearchesAttempted: 0,
    telnyxSearchesSucceeded: 0,
    telnyxSearchesFailed: 0,
    rawCandidates: count,
    uniqueCandidates: count,
    scored60Plus: candidates.filter((c) => c.score >= 60).length,
    scored70Plus: candidates.filter((c) => c.score >= 70).length,
    scored80Plus: candidates.filter((c) => c.score >= 80).length,
    scored90Plus: candidates.filter((c) => c.score >= 90).length,
    highestScore: highest,
    averageScore,
    matchedKeywords: [...matchedKeywords].sort(),
    tierCounts,
  };
}

function resolveStatus(
  candidates: ReturnType<typeof sortCandidates>,
  attempts: TelnyxSearchAttempt[],
  hadInventory: boolean,
): PremiumSearchStatus {
  const telnyxSearchesSucceeded = attempts.filter((a) => a.status === "ok").length;
  const allFailed = attempts.length > 0 && telnyxSearchesSucceeded === 0;
  const hadError = attempts.some((a) => a.status === "error");
  const allUnsupported =
    attempts.length > 0 && attempts.every((a) => a.status === "unsupported");

  if (allFailed && allUnsupported) return "SEARCH_FILTER_UNSUPPORTED";
  if (allFailed && hadError) return "TELNYX_ERROR";
  if (!hadInventory) return "NO_INVENTORY";
  if (candidates.length === 0) return "NO_INVENTORY";
  const premiumish = candidates.some((c) => c.score >= 70);
  if (!premiumish) return "RESULTS_FOUND_BUT_NONE_PREMIUM";
  return "RESULTS_FOUND";
}

function mapProviderAttemptStatus(
  status: ProviderSearchAttempt["status"],
): TelnyxSearchAttempt["status"] {
  if (status === "ok") return "ok";
  if (status === "unsupported") return "unsupported";
  return "error";
}

function filterCandidatesForAreaCodes(
  candidates: InventoryCandidateForScoring[],
  areaCodes: string[],
): InventoryCandidateForScoring[] {
  const allowed = new Set(areaCodes);
  return candidates.filter((c) => {
    const digits = parsePhoneDigits(c.phoneNumber);
    if (digits.length !== 10) return false;
    const ndc = digits.slice(0, 3);
    return allowed.has(ndc);
  });
}

export type PremiumSearchProgress = {
  candidates: ReturnType<typeof attachScarcityObservations>;
  status: PremiumSearchStatus;
  pendingProviders: NumberUpstreamProvider[];
  completedProviders: NumberUpstreamProvider[];
  currentAreaCode: string;
  providerAttempts: ProviderSearchAttempt[];
  inventoryScannedCount: number;
};

function scoreRawInventory(
  rawCandidates: InventoryCandidateForScoring[],
  input: {
    keywords: ReturnType<typeof buildKeywordEntries>;
    areaCodes: string[];
    inferredIndustry?: string;
    customKeywords?: string[];
    primaryKeywords?: string[];
    limit: number;
  },
) {
  const scored = rawCandidates
    .map((raw) => {
      const telnyxCost: TelnyxCost | undefined =
        raw.monthlyCost || raw.upfrontCost
          ? {
              upfrontCost: raw.upfrontCost,
              monthlyCost: raw.monthlyCost,
              currency: raw.currency,
            }
          : undefined;
      return scoreCandidate({
        phoneNumber: raw.phoneNumber,
        keywords: input.keywords,
        telnyxCost,
        rawTelnyx: raw.raw,
        provider: raw.provider,
        providerReference: raw.providerReference,
        searchContext: {
          mode: "business",
          requestedAreaCodes: input.areaCodes,
          industry: input.inferredIndustry,
          explicitKeywords: [
            ...(input.customKeywords ?? []),
            ...(input.primaryKeywords ?? []),
          ],
        },
      });
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const sorted = sortCandidates(scored);
  const withScarcity = attachScarcityObservations(sorted);
  return withScarcity.slice(0, input.limit);
}

/**
 * Read-only vanity / premium US number discovery against live Telnyx inventory.
 * Does not purchase, reserve, or assign numbers.
 */
export async function searchPremiumNumbers(
  input: PremiumSearchInput,
  options?: {
    onProgress?: (progress: PremiumSearchProgress) => void;
  },
): Promise<PremiumSearchResult> {
  const areaCodes =
    input.areaCodes?.length
      ? input.areaCodes.map((c) => c.replace(/\D/g, "").slice(0, 3)).filter((c) => c.length === 3)
      : [input.areaCode.replace(/\D/g, "").slice(0, 3)];

  const primaryAreaCode = areaCodes[0] ?? "";
  if (!areaCodes.length || areaCodes.some((c) => c.length !== 3)) {
    return {
      status: "NOT_CONFIGURED",
      areaCode: primaryAreaCode,
      industry: input.industry,
      keywords: [],
      candidates: [],
      statistics: buildStatistics([]),
      searchAttempts: [],
      message: "A valid 3-digit area code is required",
    };
  }

  const inferredIndustry =
    input.industry?.trim() ||
    inferIndustryFromText((input.customKeywords ?? []).join(" ")) ||
    undefined;

  const keywords = buildKeywordEntries({
    industry: inferredIndustry,
    customKeywords: input.customKeywords,
    primaryKeywords: input.primaryKeywords,
  });

  const keywordDigitStrings = [...new Set(keywords.map((k) => k.digits))];
  const matchStyle = input.matchStyle ?? "both";

  let allCandidates: Awaited<ReturnType<typeof runCombinedInventorySearches>>["candidates"] = [];
  const attempts: TelnyxSearchAttempt[] = [];
  const providerAttempts: ProviderSearchAttempt[] = [];
  const completedProviders = new Set<NumberUpstreamProvider>();
  const limit = input.limit ?? 100;

  const emitProgress = (pendingProviders: NumberUpstreamProvider[], currentAreaCode: string) => {
    if (!options?.onProgress) return;
    const byPhone = new Map<string, InventoryCandidateForScoring>();
    for (const c of allCandidates) {
      if (!byPhone.has(c.phoneNumber)) byPhone.set(c.phoneNumber, c);
    }
    const filtered = filterCandidatesForAreaCodes([...byPhone.values()], areaCodes);
    const ranked = scoreRawInventory(filtered, {
      keywords,
      areaCodes,
      inferredIndustry,
      customKeywords: input.customKeywords,
      primaryKeywords: input.primaryKeywords,
      limit,
    });
    const hadInventory = filtered.length > 0;
    options.onProgress({
      candidates: ranked,
      status: resolveStatus(ranked, attempts, hadInventory),
      pendingProviders,
      completedProviders: [...completedProviders],
      currentAreaCode,
      providerAttempts: [...providerAttempts],
      inventoryScannedCount: filtered.length,
    });
  };

  try {
    for (const areaCode of areaCodes) {
      await runCombinedInventorySearches(
        {
          areaCode,
          keywordDigitStrings,
          memorablePatterns: [...SCORING_WEIGHTS.memorablePatternSearchDigits],
          baseLimit: areaCodes.length > 1 ? 30 : 50,
          matchStyle,
        },
        {
          onProgress: ({ batch, candidates, attempts: batchAttempts }) => {
            completedProviders.add(batch.provider);
            for (const attempt of batchAttempts) {
              if (!providerAttempts.some(
                (a) => a.provider === attempt.provider && a.strategy === attempt.strategy,
              )) {
                providerAttempts.push(attempt);
              }
            }
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
            allCandidates.push(...candidates);
            emitProgress(batch.pendingProviders, batch.areaCode);
          },
        },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not configured|TELNYX_API_KEY/i.test(message)) {
      return {
        status: "NOT_CONFIGURED",
        areaCode: primaryAreaCode,
        industry: inferredIndustry,
        keywords,
        candidates: [],
        statistics: buildStatistics([]),
        searchAttempts: [],
        message,
      };
    }
    return {
      status: "TELNYX_ERROR",
      areaCode: primaryAreaCode,
      industry: inferredIndustry,
      keywords,
      candidates: [],
      statistics: buildStatistics([]),
      searchAttempts: [],
      message,
    };
  }

  const byPhone = new Map<string, Awaited<ReturnType<typeof runCombinedInventorySearches>>["candidates"][0]>();
  for (const c of allCandidates) {
    if (!byPhone.has(c.phoneNumber)) byPhone.set(c.phoneNumber, c);
  }
  allCandidates = filterCandidatesForAreaCodes([...byPhone.values()], areaCodes);

  const telnyxSearchesAttempted = attempts.length;
  const telnyxSearchesSucceeded = attempts.filter((a) => a.status === "ok").length;
  const telnyxSearchesFailed = attempts.filter((a) => a.status !== "ok").length;
  const hadInventory = allCandidates.length > 0;

  const candidates = scoreRawInventory(allCandidates, {
    keywords,
    areaCodes,
    inferredIndustry,
    customKeywords: input.customKeywords,
    primaryKeywords: input.primaryKeywords,
    limit,
  });

  const statistics = buildStatistics(candidates);
  statistics.telnyxSearchesAttempted = telnyxSearchesAttempted;
  statistics.telnyxSearchesSucceeded = telnyxSearchesSucceeded;
  statistics.telnyxSearchesFailed = telnyxSearchesFailed;
  statistics.rawCandidates = allCandidates.length;
  statistics.uniqueCandidates = candidates.length;

  const status = resolveStatus(candidates, attempts, hadInventory);

  return {
    status,
    areaCode: primaryAreaCode,
    industry: inferredIndustry,
    keywords,
    candidates,
    statistics,
    searchAttempts: attempts,
    providerAttempts,
  };
}
