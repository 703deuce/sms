import type { NumberProvider } from "./types";
import type { InventorySearchInput, InventorySearchResult } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Only active when NUMBER_SEARCH_ACCEPTANCE_INJECT=1 (acceptance tests). */
export function acceptanceInjectEnabled(): boolean {
  return process.env.NUMBER_SEARCH_ACCEPTANCE_INJECT?.trim() === "1";
}

/**
 * Injected provider outcomes for acceptance tests.
 * NUMBER_SEARCH_INJECT_FAIL=telnyx|twilio|both
 * NUMBER_SEARCH_INJECT_DELAY_MS=15000
 * NUMBER_SEARCH_INJECT_DELAY_PROVIDER=telnyx|twilio
 */
export async function runProviderSearchWithAcceptanceInject(
  provider: NumberProvider,
  input: InventorySearchInput,
): Promise<InventorySearchResult> {
  if (!acceptanceInjectEnabled()) {
    return provider.searchInventory(input);
  }

  const fail = process.env.NUMBER_SEARCH_INJECT_FAIL?.trim().toLowerCase();
  const delayMs = Number(process.env.NUMBER_SEARCH_INJECT_DELAY_MS ?? 0);
  const delayProvider = process.env.NUMBER_SEARCH_INJECT_DELAY_PROVIDER?.trim().toLowerCase();

  if (fail === "telnyx" && provider.id === "telnyx") {
    return injectedError("telnyx");
  }
  if (fail === "twilio" && provider.id === "twilio") {
    return injectedError("twilio");
  }
  if (fail === "both") {
    return injectedError(provider.id);
  }

  if (delayMs > 0 && delayProvider === provider.id) {
    await sleep(delayMs);
  }

  return provider.searchInventory(input);
}

function injectedError(provider: "telnyx" | "twilio"): InventorySearchResult {
  return {
    candidates: [],
    attempts: [
      {
        provider,
        strategy: "inventory",
        status: "error",
        error: "acceptance_injected_failure",
        resultCount: 0,
      },
    ],
  };
}
