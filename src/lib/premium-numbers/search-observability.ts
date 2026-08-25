import type { ProviderSearchAttempt } from "@/lib/numbers/providers/types";
import type { PremiumNumberProductResult, PremiumSearchProductResponse } from "./product-api";
import { BUSINESS_MATCH_LIST_THRESHOLD } from "./scoring-config";
import { parsePhoneDigits } from "./keypad";
import { resolveVanityPresentation } from "./vanity-display";
import type { ScoredCandidate, TelnyxCost } from "./types";

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

export type ProviderCostCandidate = {
  phone: string;
  provider: string;
  upfrontCost?: string | null;
  monthlyCost?: string | null;
  currency?: string | null;
  costSource?: "provider_api" | "estimate" | "unknown";
};

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function summarizeProviderCosts(candidates: ProviderCostCandidate[]) {
  const byProvider: Record<
    string,
    {
      count: number;
      with_upfront: number;
      with_monthly: number;
      upfront_min: number | null;
      upfront_max: number | null;
      monthly_min: number | null;
      monthly_max: number | null;
      cost_sources: Record<string, number>;
    }
  > = {};

  for (const c of candidates) {
    const provider = c.provider || "unknown";
    if (!byProvider[provider]) {
      byProvider[provider] = {
        count: 0,
        with_upfront: 0,
        with_monthly: 0,
        upfront_min: null,
        upfront_max: null,
        monthly_min: null,
        monthly_max: null,
        cost_sources: {},
      };
    }
    const bucket = byProvider[provider];
    bucket.count += 1;
    const src = c.costSource ?? "unknown";
    bucket.cost_sources[src] = (bucket.cost_sources[src] ?? 0) + 1;

    const upfront = parseMoney(c.upfrontCost);
    if (upfront != null) {
      bucket.with_upfront += 1;
      bucket.upfront_min =
        bucket.upfront_min == null ? upfront : Math.min(bucket.upfront_min, upfront);
      bucket.upfront_max =
        bucket.upfront_max == null ? upfront : Math.max(bucket.upfront_max, upfront);
    }

    const monthly = parseMoney(c.monthlyCost);
    if (monthly != null) {
      bucket.with_monthly += 1;
      bucket.monthly_min =
        bucket.monthly_min == null ? monthly : Math.min(bucket.monthly_min, monthly);
      bucket.monthly_max =
        bucket.monthly_max == null ? monthly : Math.max(bucket.monthly_max, monthly);
    }
  }

  return byProvider;
}

function compactCandidateCosts(candidates: ProviderCostCandidate[]) {
  return candidates.map((c) => ({
    phone: c.phone,
    provider: c.provider,
    upfront_cost: c.upfrontCost ?? null,
    monthly_cost: c.monthlyCost ?? null,
    currency: c.currency ?? null,
    cost_source: c.costSource ?? "unknown",
  }));
}

export function providerCostFromTelnyxCost(
  phone: string,
  provider: string,
  cost?: TelnyxCost,
  costSource?: ProviderCostCandidate["costSource"],
): ProviderCostCandidate {
  return {
    phone,
    provider,
    upfrontCost: cost?.upfrontCost ?? null,
    monthlyCost: cost?.monthlyCost ?? null,
    currency: cost?.currency ?? null,
    costSource: costSource ?? (cost?.monthlyCost || cost?.upfrontCost ? "provider_api" : "unknown"),
  };
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
  candidates: Array<{
    e164: string;
    provider: string;
    upfrontCost?: string | null;
    monthlyCost?: string | null;
    currency?: string | null;
    raw?: Record<string, unknown>;
  }>;
  attempts: ProviderSearchAttempt[];
  latencyMs: number;
}) {
  const candidatesByProvider = { telnyx: 0, twilio: 0 };
  const costCandidates: ProviderCostCandidate[] = [];

  for (const c of input.candidates) {
    if (c.provider === "telnyx") candidatesByProvider.telnyx += 1;
    if (c.provider === "twilio") candidatesByProvider.twilio += 1;
    const costSource =
      (c.raw?.costSource as ProviderCostCandidate["costSource"] | undefined) ??
      (c.monthlyCost || c.upfrontCost ? "provider_api" : "unknown");
    costCandidates.push({
      phone: c.e164,
      provider: c.provider,
      upfrontCost: c.upfrontCost,
      monthlyCost: c.monthlyCost,
      currency: c.currency,
      costSource,
    });
  }

  console.info(
    JSON.stringify({
      scope: "premium_number_search",
      event: "inventory",
      area_code: input.areaCode,
      latency_ms: input.latencyMs,
      candidate_count: input.candidates.length,
      candidates_by_provider: candidatesByProvider,
      provider_cost_summary: summarizeProviderCosts(costCandidates),
      candidates: compactCandidateCosts(costCandidates),
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
  inventoryCosts?: ProviderCostCandidate[];
}) {
  const resultsByProvider = { telnyx: 0, twilio: 0 };
  const resultsByNpa: Record<string, number> = {};
  const premiumByPhone = new Map(
    input.results.map((r) => [r.phoneNumber, r.premiumPriceCents]),
  );

  const inventoryCosts =
    input.inventoryCosts ??
    input.results.map((r) => ({
      phone: r.phoneNumber,
      provider: r.provider,
      upfrontCost: null,
      monthlyCost: null,
      currency: null,
      costSource: "unknown" as const,
    }));

  const compactResults = inventoryCosts.map((cost) => ({
    phone: cost.phone,
    display: cost.phone,
    provider: cost.provider,
    npa: npaFromPhone(cost.phone),
    provider_upfront_cost: cost.upfrontCost ?? null,
    provider_monthly_cost: cost.monthlyCost ?? null,
    currency: cost.currency ?? null,
    cost_source: cost.costSource ?? "unknown",
    customer_premium_price_cents: premiumByPhone.get(cost.phone) ?? null,
    provider_ref:
      input.results.find((r) => r.phoneNumber === cost.phone)?.providerReference ?? null,
    band: input.results.find((r) => r.phoneNumber === cost.phone)?.premiumPriceBand ?? null,
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
      provider_cost_summary: summarizeProviderCosts(inventoryCosts),
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
