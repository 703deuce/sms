import { numberSearchService } from "@/lib/numbers/providers/number-search-service";
import type { ProviderInventoryBatch } from "@/lib/numbers/providers/number-search-service";
import { inventoryCandidateFromNormalized } from "@/lib/numbers/providers/inventory-bridge";
import type { ProviderSearchAttempt } from "@/lib/numbers/providers/types";
import type { InventoryCandidateForScoring } from "@/lib/numbers/providers/inventory-bridge";

export type CombinedInventorySearchInput = {
  areaCode: string;
  keywordDigitStrings: string[];
  memorablePatterns: string[];
  baseLimit?: number;
  matchStyle?: "ends_with" | "contains" | "both";
};

export type CombinedInventoryProgress = {
  batch: ProviderInventoryBatch;
  candidates: InventoryCandidateForScoring[];
  attempts: ProviderSearchAttempt[];
};

export async function runCombinedInventorySearches(
  input: CombinedInventorySearchInput,
  options?: {
    onProgress?: (progress: CombinedInventoryProgress) => void;
  },
): Promise<{
  candidates: InventoryCandidateForScoring[];
  attempts: ProviderSearchAttempt[];
}> {
  const result = await numberSearchService.searchInventory(
    {
      areaCode: input.areaCode,
      keywordDigitStrings: input.keywordDigitStrings,
      memorablePatterns: input.memorablePatterns,
      baseLimit: input.baseLimit,
      matchStyle: input.matchStyle,
    },
    {
      areaCode: input.areaCode,
      onProviderBatch: (batch) => {
        if (!options?.onProgress) return;
        const candidates = batch.candidates.map(inventoryCandidateFromNormalized);
        options.onProgress({
          batch,
          candidates,
          attempts: batch.attempts,
        });
      },
    },
  );
  return {
    candidates: result.candidates.map(inventoryCandidateFromNormalized),
    attempts: result.attempts,
  };
}
