import { telnyxNumberProvider } from "./telnyx-number-provider";
import { twilioNumberProvider } from "./twilio-number-provider";
import type {
  InventorySearchInput,
  InventorySearchResult,
  NumberProvider,
  NumberUpstreamProvider,
  NormalizedNumberCandidate,
  ProviderSearchAttempt,
} from "./types";
import { dedupeCandidatesByE164 } from "./normalize";
import { logInventoryProviderSearch } from "@/lib/premium-numbers/search-observability";

const PROVIDER_TIMEOUT_MS = 15_000;

function enabledProviders(): NumberProvider[] {
  const providers: NumberProvider[] = [];
  if (telnyxNumberProvider.isConfigured()) providers.push(telnyxNumberProvider);
  if (twilioNumberProvider.isConfigured()) providers.push(twilioNumberProvider);
  return providers;
}

function withSearchTimeout(
  provider: NumberProvider,
  input: InventorySearchInput,
): Promise<InventorySearchResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        candidates: [],
        attempts: [
          {
            provider: provider.id,
            strategy: "inventory",
            status: "timeout",
            error: `Search timed out after ${PROVIDER_TIMEOUT_MS}ms`,
          },
        ],
      });
    }, PROVIDER_TIMEOUT_MS);

    provider
      .searchInventory(input)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        resolve({
          candidates: [],
          attempts: [
            {
              provider: provider.id,
              strategy: "inventory",
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            },
          ],
        });
      });
  });
}

export class NumberSearchService {
  async searchInventory(input: InventorySearchInput): Promise<{
    candidates: NormalizedNumberCandidate[];
    attempts: ProviderSearchAttempt[];
  }> {
    const started = Date.now();
    const providers = enabledProviders();
    if (providers.length === 0) {
      return {
        candidates: [],
        attempts: [
          {
            provider: "telnyx",
            strategy: "inventory",
            status: "skipped",
            error: "No number providers configured",
          },
        ],
      };
    }

    const results = await Promise.all(
      providers.map((provider) => withSearchTimeout(provider, input)),
    );

    const attempts: ProviderSearchAttempt[] = [];
    let candidates: NormalizedNumberCandidate[] = [];
    for (const result of results) {
      attempts.push(...result.attempts);
      candidates.push(...result.candidates);
    }

    candidates = dedupeCandidatesByE164(candidates);
    logInventoryProviderSearch({
      areaCode: input.areaCode,
      candidates,
      attempts,
      latencyMs: Date.now() - started,
    });
    return { candidates, attempts };
  }

  getProvider(id: NumberUpstreamProvider): NumberProvider {
    if (id === "twilio") return twilioNumberProvider;
    return telnyxNumberProvider;
  }
}

export const numberSearchService = new NumberSearchService();

export function getNumberProvider(id: NumberUpstreamProvider): NumberProvider {
  return numberSearchService.getProvider(id);
}
