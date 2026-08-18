import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import type { NumberType, TollFreePrefix } from "@/lib/premium-numbers/toll-free";
import type { NumberSearchApiIntent, NumberSearchState } from "./types";
import {
  applySearchStatePatch,
  createDefaultNumberSearchState,
  mergeKeywords,
  resetNumberSearchState,
} from "./state";

/** Manual form snapshot → shared search state (single source of truth seed). */
export function manualFormToSearchState(input: {
  numberType: NumberType;
  areaCodes: string[];
  tollFreePrefix: TollFreePrefix;
  industry: string;
  suggestedKeywordTags: string[];
  extraKeywords: string[];
  searchIntent: NumberSearchApiIntent;
  patternPrefs: PersonalPreference[];
  maxPriceCents?: number;
}): NumberSearchState {
  const explicit = input.extraKeywords.map((k) => k.trim().toUpperCase()).filter(Boolean);
  const aiSuggested = input.suggestedKeywordTags
    .map((k) => k.trim().toUpperCase())
    .filter((k) => k && !explicit.includes(k));

  return applySearchStatePatch(createDefaultNumberSearchState(), {
    numberType: input.numberType,
    areaCodes: input.areaCodes,
    tollFreePrefix: input.tollFreePrefix,
    industry: input.industry.trim(),
    explicitKeywords: explicit,
    aiGeneratedKeywords: aiSuggested,
    apiIntent: input.searchIntent,
    intent: input.searchIntent === "business_keyword" ? "business" : "personal",
    preferences: input.patternPrefs,
    maxPriceCents: input.maxPriceCents,
  });
}

/** Shared search state → manual form fields (AI → Manual sync). */
export function searchStateToManualFields(state: NumberSearchState): {
  numberType: NumberType;
  areaCodesInput: string;
  tollFreePrefix: TollFreePrefix;
  industry: string;
  suggestedKeywords: string;
  extraKeywords: string;
  searchIntent: NumberSearchApiIntent;
  patternPrefs: PersonalPreference[];
} {
  return {
    numberType: state.numberType,
    areaCodesInput: state.areaCodes.join(", "),
    tollFreePrefix: state.tollFreePrefix,
    industry: state.industry ?? "",
    suggestedKeywords: state.aiGeneratedKeywords.join(", "),
    extraKeywords: state.explicitKeywords.join(", "),
    searchIntent: state.apiIntent,
    patternPrefs: state.preferences,
  };
}

/** Strip phone-like tokens from assistant text that are not in the allowed inventory set. */
export function sanitizeAssistantMessage(
  message: string,
  allowedPhones: string[],
  allowedDisplays: string[],
): string {
  const allowed = new Set(
    [...allowedPhones, ...allowedDisplays].map((s) => s.replace(/\D/g, "")),
  );
  const phoneLike =
    message.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g) ?? [];
  for (const raw of phoneLike) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10 && !allowed.has(digits.slice(-10))) {
      return message.replace(
        raw,
        "[number not in current results — run a search to see live inventory]",
      );
    }
  }
  return message;
}

export function applyConciergeAction(
  state: NumberSearchState,
  action: import("./types").AiSearchAction,
): { state: NumberSearchState; searchPerformed: boolean; searchChanged: boolean } {
  if (action.type === "NEW_SEARCH") {
    return { state: resetNumberSearchState(), searchPerformed: false, searchChanged: true };
  }
  if (action.type === "NO_SEARCH") {
    return { state, searchPerformed: false, searchChanged: false };
  }
  if (action.type === "COMPARE_RESULTS" || action.type === "EXPLAIN_RESULT") {
    return { state, searchPerformed: false, searchChanged: false };
  }
  if (action.type === "UPDATE_SEARCH") {
    const next = applySearchStatePatch(state, action.patch);
    return { state: next, searchPerformed: action.rerun, searchChanged: true };
  }
  return { state, searchPerformed: false, searchChanged: false };
}

export function effectiveSearchSummary(state: NumberSearchState) {
  return {
    areaCodes: state.areaCodes,
    industry: state.industry ?? "",
    searchIntent: state.apiIntent,
    numberType: state.numberType,
    maxPriceCents: state.maxPriceCents,
    keywordCount: mergeKeywords(state).length,
    explicitKeywords: state.explicitKeywords,
    aiGeneratedKeywords: state.aiGeneratedKeywords,
    excludedKeywords: state.excludedKeywords,
  };
}
