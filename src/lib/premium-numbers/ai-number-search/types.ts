import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import type { PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";
import type { NumberType, TollFreePrefix } from "@/lib/premium-numbers/toll-free";

export type FindNumberSearchMode = "manual" | "ai";

export type FindNumberSortBy = "default" | "price" | "score";

export type FindNumberSearchType = "contains" | "starts_with" | "ends_with";

export type FindNumberSearchPrefId =
  | "direct_dial"
  | "vanity"
  | "sequential"
  | "shared_use"
  | "port_ready"
  | "multi_region";

export type NumberSearchIntent = "business" | "personal" | "unknown";

export type NumberSearchApiIntent = "business_keyword" | "number_pattern" | "surprise_me";

/** Shared search state — manual and AI modes use the same object. */
export type NumberSearchState = {
  numberType: NumberType;
  areaCodes: string[];
  tollFreePrefix: TollFreePrefix;
  searchType: FindNumberSearchType;
  countryProvince: string;
  serviceTags: string[];
  numberMask: string;
  searchPrefs: FindNumberSearchPrefId[];
  /** Keywords shown in UI and sent to search */
  keywords: string[];
  /** User explicitly requested (chips removable without losing user intent) */
  explicitKeywords: string[];
  /** AI-expanded synonyms — safe to drop on refinement */
  aiGeneratedKeywords: string[];
  industry?: string;
  maxPriceCents?: number;
  minPriceCents?: number;
  sortBy: FindNumberSortBy;
  intent: NumberSearchIntent;
  apiIntent: NumberSearchApiIntent;
  preferences: PersonalPreference[];
};

export type AiNumberSearchMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type AiSearchAction =
  | { type: "UPDATE_SEARCH"; patch: Partial<NumberSearchState>; rerun: boolean }
  | { type: "COMPARE_RESULTS"; resultIds: string[] }
  | { type: "EXPLAIN_RESULT"; resultId: string }
  | { type: "NO_SEARCH" }
  | { type: "NEW_SEARCH" };

export type AiNumberSearchSession = {
  id: string;
  workspaceId: string;
  userId: string;
  messages: AiNumberSearchMessage[];
  searchState: NumberSearchState;
  selectedNumberIds: string[];
  comparedNumberIds: string[];
  lastSearchAt?: string;
};

export type AiMessageApiResponse = {
  sessionId: string;
  assistantMessage: string;
  searchState: NumberSearchState;
  searchChanged: boolean;
  searchPerformed: boolean;
  suggestedActions: string[];
  messages: AiNumberSearchMessage[];
  understandingChips: Array<{ id: string; label: string; kind: "explicit" | "ai" | "filter" }>;
  /** Present when search was not rerun but client should refresh explanation */
  explainOnly?: boolean;
};

export type AiClientResultContext = {
  results: PremiumSearchProductResponse | null;
  favorites: string[];
};
