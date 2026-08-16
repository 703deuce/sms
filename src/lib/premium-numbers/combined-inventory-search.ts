import { numberSearchService } from "@/lib/numbers/providers/number-search-service";
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

export async function runCombinedInventorySearches(
  input: CombinedInventorySearchInput,
): Promise<{
  candidates: InventoryCandidateForScoring[];
  attempts: ProviderSearchAttempt[];
}> {
  const result = await numberSearchService.searchInventory({
    areaCode: input.areaCode,
    keywordDigitStrings: input.keywordDigitStrings,
    memorablePatterns: input.memorablePatterns,
    baseLimit: input.baseLimit,
    matchStyle: input.matchStyle,
  });
  return {
    candidates: result.candidates.map(inventoryCandidateFromNormalized),
    attempts: result.attempts,
  };
}
