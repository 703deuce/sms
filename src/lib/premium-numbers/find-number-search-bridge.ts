"use client";

import type { NumberSearchState } from "@/lib/premium-numbers/ai-number-search/types";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import { toApiPreferences } from "@/lib/premium-numbers/ai-number-search/state";

export function buildPremiumSearchBody(
  workspaceId: string,
  state: NumberSearchState,
): Record<string, unknown> {
  const keywords = state.keywords;
  const maskKeywords = state.numberMask.match(/[A-Za-z]+/g)?.map((w) => w.toUpperCase()) ?? [];

  if (state.apiIntent === "business_keyword") {
    return {
      workspaceId,
      mode: "business" as const,
      numberType: state.numberType,
      areaCodes: state.areaCodes,
      tollFreePrefix: state.numberType === "tollfree" ? state.tollFreePrefix : undefined,
      industry: state.industry || "local services",
      suggestedKeywords: keywords.length ? keywords : maskKeywords,
      extraKeywords: [...keywords, ...maskKeywords],
    };
  }

  if (state.apiIntent === "surprise_me") {
    return {
      workspaceId,
      mode: "personal" as const,
      areaCodes: state.areaCodes,
      preferences: ["surprise_me"] as PersonalPreference[],
    };
  }

  return {
    workspaceId,
    mode: "personal" as const,
    areaCodes: state.areaCodes,
    preferences: toApiPreferences(state.searchPrefs, state.searchType),
  };
}

export function filterResultsByMaxPrice<T extends { premiumPriceCents: number }>(
  results: T[],
  maxPriceCents?: number,
): T[] {
  if (!maxPriceCents) return results;
  return results.filter((r) => r.premiumPriceCents <= maxPriceCents);
}
