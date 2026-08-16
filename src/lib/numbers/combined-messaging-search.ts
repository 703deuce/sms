/**
 * Parallel Telnyx + Twilio browse search for standard number purchase flows.
 * Provider is attached on each result for backend purchase routing (not shown in UI).
 */
import { telnyxProvider } from "@/lib/messaging/telnyx/provider";
import { assertTelnyxConfigured } from "@/lib/messaging/telnyx/config";
import { twilioAdapter } from "@/lib/messaging/twilio-adapter";
import { assertLiveTwilioConfigured } from "@/lib/messaging/twilio-config";
import type { NumberSearchOptions, NumberSearchResult } from "@/lib/messaging/types";
import type { NumberUpstreamProvider } from "@/lib/numbers/providers/types";

const SEARCH_TIMEOUT_MS = 12_000;

export type CombinedNumberSearchResult = NumberSearchResult & {
  upstreamProvider: NumberUpstreamProvider;
};

function withSearchTimeout<T>(promise: Promise<T>, label: string): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(JSON.stringify({ scope: "combined_messaging_search", provider: label, status: "timeout" }));
      resolve(null);
    }, SEARCH_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn(
          JSON.stringify({
            scope: "combined_messaging_search",
            provider: label,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        resolve(null);
      });
  });
}

function postFilter(
  results: NumberSearchResult[],
  options?: NumberSearchOptions,
): NumberSearchResult[] {
  if (!options) return results;
  const contains = options.contains?.replace(/\D/g, "");
  const locality = options.locality?.trim().toLowerCase();
  return results.filter((r) => {
    if (options.mms && !r.capabilities?.mms) return false;
    if (contains && !r.phoneNumber.replace(/\D/g, "").includes(contains)) return false;
    if (locality && !(r.locality || "").toLowerCase().includes(locality)) return false;
    return true;
  });
}

async function searchTelnyx(
  areaCode?: string,
  options?: NumberSearchOptions,
): Promise<CombinedNumberSearchResult[]> {
  try {
    assertTelnyxConfigured();
  } catch {
    return [];
  }
  const results = await telnyxProvider.searchNumbers(areaCode, options);
  return postFilter(results, options).map((r) => ({ ...r, upstreamProvider: "telnyx" }));
}

async function searchTwilio(
  areaCode?: string,
  options?: NumberSearchOptions,
): Promise<CombinedNumberSearchResult[]> {
  try {
    assertLiveTwilioConfigured();
  } catch {
    return [];
  }
  const results = await twilioAdapter.searchNumbers(areaCode, options);
  return postFilter(results, options).map((r) => ({ ...r, upstreamProvider: "twilio" }));
}

function mergeResults(
  batches: CombinedNumberSearchResult[][],
): CombinedNumberSearchResult[] {
  const byPhone = new Map<string, CombinedNumberSearchResult>();
  for (const batch of batches) {
    for (const item of batch) {
      const existing = byPhone.get(item.phoneNumber);
      if (!existing) {
        byPhone.set(item.phoneNumber, item);
        continue;
      }
      if (existing.upstreamProvider === "twilio" && item.upstreamProvider === "telnyx") {
        byPhone.set(item.phoneNumber, item);
      }
    }
  }
  return [...byPhone.values()];
}

export async function searchCombinedMessagingNumbers(
  areaCode?: string,
  options?: NumberSearchOptions,
): Promise<CombinedNumberSearchResult[]> {
  const [telnyxBatch, twilioBatch] = await Promise.all([
    withSearchTimeout(searchTelnyx(areaCode, options), "telnyx"),
    withSearchTimeout(searchTwilio(areaCode, options), "twilio"),
  ]);

  return mergeResults([
    telnyxBatch ?? [],
    twilioBatch ?? [],
  ]);
}
