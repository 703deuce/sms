import { buildKeywordEntries } from "./industry-keywords";
import { parsePhoneDigits } from "./keypad";
import { scoreCandidate, sortCandidates } from "./scoring";
import { SCORING_WEIGHTS } from "./scoring-config";
import { runTelnyxInventorySearches } from "./telnyx-inventory-search";
import type {
  PremiumSearchInput,
  PremiumSearchResult,
  PremiumSearchStatistics,
  PremiumSearchStatus,
  QualityTier,
  TelnyxCost,
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
  attempts: import("./types").TelnyxSearchAttempt[],
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

/**
 * Read-only vanity / premium local US number discovery against live Telnyx inventory.
 * Does not purchase, reserve, or assign numbers.
 */
export async function searchPremiumNumbers(
  input: PremiumSearchInput,
): Promise<PremiumSearchResult> {
  const areaCode = input.areaCode.replace(/\D/g, "").slice(0, 3);
  if (areaCode.length !== 3) {
    return {
      status: "NOT_CONFIGURED",
      areaCode,
      industry: input.industry,
      keywords: [],
      candidates: [],
      statistics: buildStatistics([]),
      searchAttempts: [],
      message: "areaCode must be a 3-digit US area code",
    };
  }

  const keywords = buildKeywordEntries({
    industry: input.industry,
    customKeywords: input.customKeywords,
  });

  const keywordDigitStrings = [...new Set(keywords.map((k) => k.digits))];

  let inventory;
  try {
    inventory = await runTelnyxInventorySearches({
      areaCode,
      keywordDigitStrings,
      memorablePatterns: [...SCORING_WEIGHTS.memorablePatternSearchDigits],
      baseLimit: 50,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not configured|TELNYX_API_KEY/i.test(message)) {
      return {
        status: "NOT_CONFIGURED",
        areaCode,
        industry: input.industry,
        keywords,
        candidates: [],
        statistics: buildStatistics([]),
        searchAttempts: [],
        message,
      };
    }
    return {
      status: "TELNYX_ERROR",
      areaCode,
      industry: input.industry,
      keywords,
      candidates: [],
      statistics: buildStatistics([]),
      searchAttempts: [],
      message,
    };
  }

  // best_effort can return nearby NDCs — keep only the requested area code.
  inventory.candidates = inventory.candidates.filter((c) => {
    const digits = parsePhoneDigits(c.phoneNumber);
    return digits.length === 10 && digits.startsWith(areaCode);
  });

  const attempts = inventory.attempts;
  const telnyxSearchesAttempted = attempts.length;
  const telnyxSearchesSucceeded = attempts.filter((a) => a.status === "ok").length;
  const telnyxSearchesFailed = attempts.filter((a) => a.status !== "ok").length;
  const hadInventory = inventory.candidates.length > 0;

  const scored = inventory.candidates
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
        keywords,
        telnyxCost,
        rawTelnyx: raw.raw,
      });
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const sorted = sortCandidates(scored);
  const limit = input.limit ?? 100;
  const candidates = sorted.slice(0, limit);

  const statistics = buildStatistics(sorted);
  statistics.telnyxSearchesAttempted = telnyxSearchesAttempted;
  statistics.telnyxSearchesSucceeded = telnyxSearchesSucceeded;
  statistics.telnyxSearchesFailed = telnyxSearchesFailed;
  statistics.rawCandidates = inventory.candidates.length;
  statistics.uniqueCandidates = sorted.length;

  const status = resolveStatus(sorted, attempts, hadInventory);

  return {
    status,
    areaCode,
    industry: input.industry,
    keywords,
    candidates,
    statistics,
    searchAttempts: attempts,
  };
}
