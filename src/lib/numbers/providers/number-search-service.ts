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
import { runProviderSearchWithAcceptanceInject } from "./acceptance-inject";

export type ProviderInventoryBatch = {
  provider: NumberUpstreamProvider;
  candidates: NormalizedNumberCandidate[];
  attempts: ProviderSearchAttempt[];
  latencyMs: number;
  areaCode: string;
  pendingProviders: NumberUpstreamProvider[];
};

function enabledProviders(): NumberProvider[] {
  const providers: NumberProvider[] = [];
  if (telnyxNumberProvider.isConfigured()) providers.push(telnyxNumberProvider);
  if (twilioNumberProvider.isConfigured()) providers.push(twilioNumberProvider);
  return providers;
}

export class NumberSearchService {
  /**
   * Query all configured providers in parallel with no artificial timeout.
   * Telnyx inventory can take minutes; callers should stream partial UI updates.
   */
  async searchInventory(
    input: InventorySearchInput,
    options?: {
      areaCode?: string;
      onProviderBatch?: (batch: ProviderInventoryBatch) => void;
    },
  ): Promise<{
    candidates: NormalizedNumberCandidate[];
    attempts: ProviderSearchAttempt[];
  }> {
    const started = Date.now();
    const areaCode = options?.areaCode ?? input.areaCode;
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

    const pending = new Set(providers.map((p) => p.id));
    const attempts: ProviderSearchAttempt[] = [];
    let candidates: NormalizedNumberCandidate[] = [];

    const runProvider = async (provider: NumberProvider): Promise<InventorySearchResult> => {
      const providerStarted = Date.now();
      try {
        const result = await runProviderSearchWithAcceptanceInject(provider, input);
        pending.delete(provider.id);
        candidates = dedupeCandidatesByE164([...candidates, ...result.candidates]);
        attempts.push(...result.attempts);
        options?.onProviderBatch?.({
          provider: provider.id,
          candidates: result.candidates,
          attempts: result.attempts,
          latencyMs: Date.now() - providerStarted,
          areaCode,
          pendingProviders: [...pending],
        });
        logInventoryProviderSearch({
          areaCode,
          candidates: result.candidates,
          attempts: result.attempts,
          latencyMs: Date.now() - providerStarted,
        });
        return result;
      } catch (err) {
        pending.delete(provider.id);
        const error = err instanceof Error ? err.message : String(err);
        const failed: InventorySearchResult = {
          candidates: [],
          attempts: [
            {
              provider: provider.id,
              strategy: "inventory",
              status: "error",
              error,
            },
          ],
        };
        attempts.push(...failed.attempts);
        options?.onProviderBatch?.({
          provider: provider.id,
          candidates: [],
          attempts: failed.attempts,
          latencyMs: Date.now() - providerStarted,
          areaCode,
          pendingProviders: [...pending],
        });
        return failed;
      }
    };

    await Promise.all(providers.map((provider) => runProvider(provider)));

    logInventoryProviderSearch({
      areaCode,
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
