import type { ProviderSearchAttempt } from "@/lib/numbers/providers/types";
import type { PremiumNumberProductResult } from "./product-api";
import { parsePhoneDigits } from "./keypad";

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
      results: compactResults,
    }),
  );
}
