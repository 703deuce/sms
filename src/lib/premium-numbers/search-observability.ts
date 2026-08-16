import type { ProviderSearchAttempt } from "@/lib/numbers/providers/types";
import type { PremiumNumberProductResult, PremiumSearchProductResponse } from "./product-api";
import { BUSINESS_MATCH_LIST_THRESHOLD } from "./scoring-config";
import { parsePhoneDigits } from "./keypad";
import { resolveVanityPresentation } from "./vanity-display";
import type { ScoredCandidate } from "./types";

function npaFromPhone(phone: string): string {
  const digits = parsePhoneDigits(phone);
  return digits.length >= 10 ? digits.slice(0, 3) : "?";
}

function summarizeAttempts(attempts: ProviderSearchAttempt[]) {
  return attempts.map((a) => ({
    provider: a.provider,
    strategy: a.strategy,
    status: a.status,
    result_count: a.resultCount ?? 0,
    error: a.error ?? null,
  }));
}

export function buildSearchUiBreakdown(input: {
  product: PremiumSearchProductResponse;
  rankedCandidates?: ScoredCandidate[];
}) {
  let exactMatchBadges = 0;
  let strongMatchBadges = 0;
  let keywordMatchBadges = 0;

  for (const r of input.product.bestMatches) {
    if (
      r.displayWord &&
      r.wordPlacement === "ending" &&
      r.businessMatchScore >= 75
    ) {
      exactMatchBadges += 1;
    } else if (r.displayWord && r.wordPlacement === "ending") {
      strongMatchBadges += 1;
    } else if (r.displayWord && r.wordPlacement === "embedded") {
      keywordMatchBadges += 1;
    }
  }

  const bestMatchPhones = new Set(input.product.bestMatches.map((r) => r.phoneNumber));
  const excludedWordMatches: Array<{
    phone: string;
    display: string;
    words: string[];
    display_word: string | null;
    business_match_score: number;
    reasons: string[];
  }> = [];

  if (input.rankedCandidates) {
    for (const c of input.rankedCandidates) {
      if (!c.matchedWords.length || bestMatchPhones.has(c.phoneNumber)) continue;
      const vanity = resolveVanityPresentation(
        c.phoneNumber,
        c.matchedWords,
        c.rawTelnyx?.vanity_format as string | undefined,
      );
      const reasons: string[] = [];
      if (c.businessMatchScore < BUSINESS_MATCH_LIST_THRESHOLD) {
        reasons.push(`business_match_score_below_${BUSINESS_MATCH_LIST_THRESHOLD}`);
      }
      if (!vanity.displayWord) reasons.push("no_display_word");
      excludedWordMatches.push({
        phone: c.phoneNumber,
        display: c.formattedNumber,
        words: c.matchedWords,
        display_word: vanity.displayWord ?? null,
        business_match_score: c.businessMatchScore,
        reasons,
      });
    }
  }

  return {
    best_matches_cards: input.product.bestMatches.length,
    memorable_cards: input.product.memorableAlternatives.length,
    exact_match_badges: exactMatchBadges,
    strong_match_badges: strongMatchBadges,
    keyword_match_badges: keywordMatchBadges,
    business_match_count_api: input.product.businessMatchCount,
    memorable_count_api: input.product.memorableCount,
    excluded_word_matches: excludedWordMatches.length,
    excluded_word_match_samples: excludedWordMatches.slice(0, 12),
    best_match_numbers: input.product.bestMatches.map((r) => ({
      phone: r.phoneNumber,
      display: r.displayNumber,
      vanity: r.vanityDisplay ?? null,
      word: r.displayWord ?? null,
      placement: r.wordPlacement ?? null,
      provider: r.provider,
      business_match_score: r.businessMatchScore,
      badge:
        r.displayWord && r.wordPlacement === "ending" && r.businessMatchScore >= 75
          ? "EXACT_MATCH"
          : r.displayWord && r.wordPlacement === "ending"
            ? "STRONG_MATCH"
            : r.displayWord && r.wordPlacement === "embedded"
              ? "KEYWORD_MATCH"
              : "BUSINESS_SECTION_NO_BADGE",
    })),
  };
}

/** Per area-code inventory fetch — emitted from NumberSearchService (Coolify / stdout). */
export function logInventoryProviderSearch(input: {
  areaCode: string;
  candidates: Array<{ provider: string }>;
  attempts: ProviderSearchAttempt[];
  latencyMs: number;
}) {
  const candidatesByProvider = { telnyx: 0, twilio: 0 };
  for (const c of input.candidates) {
    if (c.provider === "telnyx") candidatesByProvider.telnyx += 1;
    if (c.provider === "twilio") candidatesByProvider.twilio += 1;
  }

  console.info(
    JSON.stringify({
      scope: "premium_number_search",
      event: "inventory",
      area_code: input.areaCode,
      latency_ms: input.latencyMs,
      candidate_count: input.candidates.length,
      candidates_by_provider: candidatesByProvider,
      attempts: summarizeAttempts(input.attempts),
    }),
  );
}

/** Full premium search session — emitted from /api/numbers/premium/search (not shown in UI). */
export function logPremiumSearchCompleted(input: {
  searchLogId: string;
  workspaceId: string;
  userId: string;
  mode: string;
  areaCodes: string[];
  industry?: string | null;
  keywords?: string[];
  keywordSource?: string | null;
  status: string;
  message?: string | null;
  elapsedMs: number;
  businessMatchCount: number;
  memorableCount: number;
  totalResults: number;
  results: PremiumNumberProductResult[];
  providerAttempts?: ProviderSearchAttempt[];
  uiBreakdown?: ReturnType<typeof buildSearchUiBreakdown>;
}) {
  const resultsByProvider = { telnyx: 0, twilio: 0 };
  const resultsByNpa: Record<string, number> = {};
  const compactResults = input.results.map((r) => ({
    phone: r.phoneNumber,
    display: r.displayNumber,
    provider: r.provider,
    npa: npaFromPhone(r.phoneNumber),
    vanity: r.vanityDisplay ?? null,
    band: r.premiumPriceBand,
    matched: r.matchedWords[0] ?? null,
    section: r.listSection,
    provider_ref: r.providerReference ?? null,
  }));

  for (const r of input.results) {
    resultsByProvider[r.provider] += 1;
    const code = npaFromPhone(r.phoneNumber);
    resultsByNpa[code] = (resultsByNpa[code] ?? 0) + 1;
  }

  console.info(
    JSON.stringify({
      scope: "premium_number_search",
      event: "completed",
      search_log_id: input.searchLogId,
      workspace_id: input.workspaceId,
      user_id: input.userId,
      mode: input.mode,
      area_codes: input.areaCodes,
      industry: input.industry ?? null,
      keywords: input.keywords ?? [],
      keyword_source: input.keywordSource ?? null,
      status: input.status,
      message: input.message ?? null,
      elapsed_ms: input.elapsedMs,
      business_match_count: input.businessMatchCount,
      memorable_count: input.memorableCount,
      total_results: input.totalResults,
      results_by_provider: resultsByProvider,
      results_by_npa: resultsByNpa,
      provider_attempts: input.providerAttempts
        ? summarizeAttempts(input.providerAttempts)
        : [],
      provider_warnings: (input.providerAttempts ?? [])
        .filter((a) => a.status === "timeout" || a.status === "error" || a.status === "skipped")
        .map((a) => ({
          provider: a.provider,
          strategy: a.strategy,
          status: a.status,
          error: a.error ?? null,
        })),
      ui_breakdown: input.uiBreakdown ?? null,
      results: compactResults,
    }),
  );
}
