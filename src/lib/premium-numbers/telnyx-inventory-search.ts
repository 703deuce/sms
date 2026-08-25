import { TelnyxApiError, telnyxRequest } from "@/lib/messaging/telnyx/client";
import { assertTelnyxConfigured } from "@/lib/messaging/telnyx/config";
import type { TelnyxSearchAttempt } from "./types";

type TelnyxListResponse<T> = { data: T[]; meta?: { total_results?: number } };

export type TelnyxRawCandidate = {
  phoneNumber: string;
  upfrontCost?: string;
  monthlyCost?: string;
  currency?: string;
  vanityFormat?: string;
  raw: Record<string, unknown>;
};

export type InventorySearchOptions = {
  areaCode: string;
  endsWith?: string;
  contains?: string;
  startsWith?: string;
  limit?: number;
  strategy: string;
};

export type KeywordMatchStyle = "ends_with" | "contains" | "both";

const DEFAULT_PER_SEARCH_LIMIT = 20;

function buildQuery(opts: InventorySearchOptions): Record<string, string | number> {
  const limit = opts.limit ?? DEFAULT_PER_SEARCH_LIMIT;
  const query: Record<string, string | number> = {
    "filter[country_code]": "US",
    "filter[features]": "sms,voice",
    "filter[national_destination_code]": opts.areaCode,
    "filter[limit]": limit,
    "filter[best_effort]": "true",
  };
  if (opts.endsWith) query["filter[phone_number][ends_with]"] = opts.endsWith;
  if (opts.contains) query["filter[phone_number][contains]"] = opts.contains;
  if (opts.startsWith) query["filter[phone_number][starts_with]"] = opts.startsWith;
  return query;
}

function isTelnyxEmptyInventoryError(err: unknown): boolean {
  if (!(err instanceof TelnyxApiError)) return false;
  const body = err.body;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return (
    text.includes("10031") ||
    /no numbers found/i.test(text) ||
    /best_effort=true/i.test(text)
  );
}

function mapTelnyxNumber(
  n: {
    phone_number: string;
    vanity_format?: string;
    cost_information?: {
      upfront_cost?: string;
      monthly_cost?: string;
      currency?: string;
    };
  },
): TelnyxRawCandidate {
  return {
    phoneNumber: n.phone_number,
    upfrontCost: n.cost_information?.upfront_cost,
    monthlyCost: n.cost_information?.monthly_cost,
    currency: n.cost_information?.currency,
    vanityFormat: n.vanity_format,
    raw: n as Record<string, unknown>,
  };
}

export async function searchTelnyxInventoryOnce(
  opts: InventorySearchOptions,
): Promise<{ candidates: TelnyxRawCandidate[]; attempt: TelnyxSearchAttempt }> {
  const query = buildQuery(opts);
  try {
    assertTelnyxConfigured();
    const res = await telnyxRequest<
      TelnyxListResponse<{
        phone_number: string;
        vanity_format?: string;
        cost_information?: {
          upfront_cost?: string;
          monthly_cost?: string;
          currency?: string;
        };
      }>
    >("/available_phone_numbers", { query, noRetry: false, maxAttempts: 2 });

    const candidates = (res.data || []).map(mapTelnyxNumber);
    return {
      candidates,
      attempt: {
        strategy: opts.strategy,
        query,
        resultCount: candidates.length,
        status: "ok",
      },
    };
  } catch (err) {
    if (isTelnyxEmptyInventoryError(err)) {
      return {
        candidates: [],
        attempt: {
          strategy: opts.strategy,
          query,
          resultCount: 0,
          status: "ok",
        },
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    const status =
      err instanceof TelnyxApiError && (err.status === 400 || err.status === 422)
        ? "unsupported"
        : "error";
    return {
      candidates: [],
      attempt: {
        strategy: opts.strategy,
        query,
        resultCount: 0,
        status,
        error: message,
      },
    };
  }
}

type PatternFilterChunks = {
  endsWith: string[];
  contains: string[];
  startsWith: string[];
};

/** Telnyx limits pattern filters with NDC — ends_with/contains max ~4 digits on subscriber tail. */
export function patternFilterChunks(digits: string): PatternFilterChunks {
  const endsWith: string[] = [];
  const contains: string[] = [];
  const startsWith: string[] = [];

  if (digits.length <= 4) {
    endsWith.push(digits);
    return { endsWith, contains, startsWith };
  }

  endsWith.push(digits.slice(-4));

  const head5 = digits.slice(0, Math.min(5, digits.length));
  if (head5.length >= 3) startsWith.push(head5);
  if (digits.length >= 5) startsWith.push(digits.slice(0, 4));

  // Sliding 4-digit windows — surfaces rare 5–7 letter word inventory.
  for (let i = 0; i <= digits.length - 4; i++) {
    contains.push(digits.slice(i, i + 4));
  }

  const dedupe = (values: string[]) => [...new Set(values)];
  return {
    endsWith: dedupe(endsWith),
    contains: dedupe(contains),
    startsWith: dedupe(startsWith),
  };
}

export async function runTelnyxInventorySearches(input: {
  areaCode: string;
  keywordDigitStrings: string[];
  memorablePatterns: string[];
  baseLimit?: number;
  matchStyle?: KeywordMatchStyle;
}): Promise<{
  candidates: TelnyxRawCandidate[];
  attempts: TelnyxSearchAttempt[];
}> {
  const matchStyle = input.matchStyle ?? "both";
  const attempts: TelnyxSearchAttempt[] = [];
  const byPhone = new Map<string, TelnyxRawCandidate>();
  const seenQueries = new Set<string>();

  const run = async (opts: InventorySearchOptions) => {
    const queryKey = JSON.stringify({
      areaCode: opts.areaCode,
      endsWith: opts.endsWith ?? "",
      contains: opts.contains ?? "",
      startsWith: opts.startsWith ?? "",
    });
    if (seenQueries.has(queryKey)) return;
    seenQueries.add(queryKey);

    const { candidates, attempt } = await searchTelnyxInventoryOnce(opts);
    attempts.push(attempt);
    for (const c of candidates) {
      if (!byPhone.has(c.phoneNumber)) byPhone.set(c.phoneNumber, c);
    }
  };

  await run({
    areaCode: input.areaCode,
    strategy: "base_inventory",
    limit: input.baseLimit ?? 50,
  });

  for (const digits of input.keywordDigitStrings) {
    const chunks = patternFilterChunks(digits);
    if (matchStyle === "ends_with" || matchStyle === "both") {
      for (const tail of chunks.endsWith) {
        await run({
          areaCode: input.areaCode,
          strategy: `keyword_ends_with:${digits}:${tail}`,
          endsWith: tail,
        });
      }
    }
    if (matchStyle === "contains" || matchStyle === "both") {
      for (const mid of chunks.contains) {
        await run({
          areaCode: input.areaCode,
          strategy: `keyword_contains:${digits}:${mid}`,
          contains: mid,
        });
      }
    }
    if (matchStyle === "both") {
      for (const head of chunks.startsWith) {
        await run({
          areaCode: input.areaCode,
          strategy: `keyword_starts_with:${digits}:${head}`,
          startsWith: head,
        });
      }
    }
  }

  for (const pattern of input.memorablePatterns) {
    await run({
      areaCode: input.areaCode,
      strategy: `memorable_ends_with:${pattern}`,
      endsWith: pattern,
    });
  }

  return { candidates: [...byPhone.values()], attempts };
}
