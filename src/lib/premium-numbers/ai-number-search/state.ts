import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import type {
  FindNumberSearchPrefId,
  FindNumberSearchType,
  NumberSearchApiIntent,
  NumberSearchIntent,
  NumberSearchState,
} from "./types";

const DEFAULT_SERVICE_TAGS = ["SMS", "MMS", "Voice", "Fax"];

export function createDefaultNumberSearchState(): NumberSearchState {
  return {
    numberType: "local",
    areaCodes: [],
    tollFreePrefix: "all",
    searchType: "contains",
    countryProvince: "Vermont",
    serviceTags: [...DEFAULT_SERVICE_TAGS],
    numberMask: "",
    searchPrefs: ["direct_dial", "vanity"],
    keywords: [],
    explicitKeywords: [],
    aiGeneratedKeywords: [],
    excludedKeywords: [],
    industry: undefined,
    maxPriceCents: undefined,
    minPriceCents: undefined,
    sortBy: "default",
    intent: "unknown",
    apiIntent: "business_keyword",
    preferences: ["surprise_me"],
  };
}

function uniqueUpper(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const n = w.trim().toUpperCase();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function mergeKeywords(state: NumberSearchState): string[] {
  const excluded = new Set(state.excludedKeywords.map((k) => k.toUpperCase()));
  return uniqueUpper([
    ...state.explicitKeywords.filter((k) => !excluded.has(k.toUpperCase())),
    ...state.aiGeneratedKeywords.filter((k) => !excluded.has(k.toUpperCase())),
    ...state.keywords.filter(
      (k) =>
        !excluded.has(k.toUpperCase()) &&
        !state.explicitKeywords.includes(k.toUpperCase()) &&
        !state.aiGeneratedKeywords.includes(k.toUpperCase()),
    ),
  ]);
}

export function deriveApiIntent(
  searchType: FindNumberSearchType,
  searchPrefs: FindNumberSearchPrefId[],
): NumberSearchApiIntent {
  if (searchType === "ends_with" || searchPrefs.includes("sequential")) {
    return "number_pattern";
  }
  if (
    searchPrefs.includes("vanity") ||
    searchType === "contains" ||
    searchType === "starts_with"
  ) {
    return "business_keyword";
  }
  return "surprise_me";
}

export function toApiPreferences(
  searchPrefs: FindNumberSearchPrefId[],
  searchType: FindNumberSearchType,
): PersonalPreference[] {
  const prefs: PersonalPreference[] = [];
  if (searchPrefs.includes("sequential") || searchType === "ends_with") {
    prefs.push("easy_sequence", "repeating_pair", "ends_0000");
  }
  if (searchPrefs.includes("direct_dial")) prefs.push("very_memorable");
  if (searchPrefs.includes("vanity")) {
    prefs.push("very_memorable", "repeating_digits");
  }
  if (!prefs.length) {
    return searchType === "ends_with" ? ["ends_0000"] : ["surprise_me"];
  }
  return [...new Set(prefs)];
}

export function applySearchStatePatch(
  state: NumberSearchState,
  patch: Partial<NumberSearchState>,
): NumberSearchState {
  const next: NumberSearchState = {
    ...state,
    ...patch,
    serviceTags: patch.serviceTags ? [...patch.serviceTags] : [...state.serviceTags],
    areaCodes: patch.areaCodes ? [...patch.areaCodes] : [...state.areaCodes],
    searchPrefs: patch.searchPrefs ? [...patch.searchPrefs] : [...state.searchPrefs],
    keywords: patch.keywords ? [...patch.keywords] : [...state.keywords],
    explicitKeywords: patch.explicitKeywords
      ? uniqueUpper(patch.explicitKeywords)
      : [...state.explicitKeywords],
    aiGeneratedKeywords: patch.aiGeneratedKeywords
      ? uniqueUpper(patch.aiGeneratedKeywords)
      : [...state.aiGeneratedKeywords],
    excludedKeywords: patch.excludedKeywords
      ? uniqueUpper(patch.excludedKeywords)
      : [...state.excludedKeywords],
    preferences: patch.preferences ? [...patch.preferences] : [...state.preferences],
  };

  next.apiIntent =
    patch.apiIntent ??
    deriveApiIntent(next.searchType, next.searchPrefs);
  next.keywords = mergeKeywords(next);
  if (patch.intent) next.intent = patch.intent as NumberSearchIntent;
  if (next.industry && next.intent === "unknown") next.intent = "business";
  next.preferences =
    next.apiIntent === "business_keyword"
      ? next.preferences
      : toApiPreferences(next.searchPrefs, next.searchType);

  return next;
}

export function resetNumberSearchState(): NumberSearchState {
  return createDefaultNumberSearchState();
}
