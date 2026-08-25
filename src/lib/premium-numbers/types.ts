import type { ProviderSearchAttempt } from "@/lib/numbers/providers/types";

export type PremiumSearchStatus =
  | "RESULTS_FOUND"
  | "RESULTS_FOUND_BUT_NONE_PREMIUM"
  | "NO_INVENTORY"
  | "TELNYX_ERROR"
  | "SEARCH_FILTER_UNSUPPORTED"
  | "NOT_CONFIGURED";

export type QualityTier =
  | "Exceptional"
  | "Premium"
  | "Excellent"
  | "Good"
  | "Nice"
  | "Ordinary";

/** Intrinsic number memorability label (search-independent). */
export type NumberQualityLabel =
  | "Standard"
  | "Distinctive"
  | "Memorable"
  | "Highly Memorable"
  | "Premium Pattern"
  | "Elite Number"
  | "Signature Number";

/** Business-fit label for the active search context. */
export type BusinessFitLabel =
  | "No Direct Match"
  | "Related"
  | "Good Business Match"
  | "Strong Business Match"
  | "Excellent Business Match"
  | "Exceptional Business Match";

export type KeywordTier = "PRIMARY" | "SECONDARY" | "TERTIARY";

export type KeywordEntry = {
  word: string;
  digits: string;
  tier: KeywordTier;
  /** @deprecated use tier — kept for transitional callers */
  isPrimary: boolean;
  /** @deprecated use tier */
  isSecondary: boolean;
};

export type ScoringReason = {
  label: string;
  points: number;
};

export type TelnyxCost = {
  upfrontCost?: string;
  monthlyCost?: string;
  currency?: string;
};

export type ScarcityObservation = {
  exactComparableCount: number;
  patternFamilyComparableCount: number;
  areaCode: string;
  observationDate: string;
  keyword?: string;
  patternFamily?: string;
  observationWindowDays: number;
};

export type PersonalSearchPreferences = {
  requestedAreaCodes?: string[];
  nameTokens?: string[];
  requestedEndingDigits?: string[];
  birthdayDigits?: string[];
  anniversaryDigits?: string[];
  favoriteDigits?: string[];
  hobbyKeywords?: string[];
};

export type ScoringSearchContext = {
  /** Explicitly prevents personal/general searches from receiving business inflation. */
  mode?: "personal" | "business";
  requestedAreaCodes?: string[];
  industry?: string;
  /** User-supplied keywords — unlock stronger 3-letter matches when listed. */
  explicitKeywords?: string[];
  personalPreferences?: PersonalSearchPreferences;
};

export type ScoredCandidate = {
  phoneNumber: string;
  formattedNumber: string;
  /** Blended overall score (70% business + 30% number quality) for list ranking. */
  score: number;
  tier: QualityTier;
  /** Inherent memorability regardless of who searches (0–100). */
  numberQualityScore: number;
  /** Fit for the active business/industry search (0–100). */
  businessMatchScore: number;
  /** Objective commercial usefulness of decoded word(s) (0–100). */
  commercialSemanticScore: number;
  /** Personal preference fit when personal context is supplied (0–100). */
  personalMatchScore?: number;
  /** Area code matches customer's requested locality (0–100). */
  localFitScore: number;
  /** Broad area-code market desirability — conservative until market data exists. */
  areaCodeMarketScore: number;
  numberQualityLabel: NumberQualityLabel;
  businessFitLabel: BusinessFitLabel;
  matchedWords: string[];
  matchedPatterns: string[];
  reasons: ScoringReason[];
  businessReasons: ScoringReason[];
  numberQualityReasons: ScoringReason[];
  telnyxCost?: TelnyxCost;
  providerPremiumFlag: boolean;
  providerCostPremiumSignal: boolean;
  scarcity?: ScarcityObservation;
  rawDigits: string;
  subscriberDigits: string;
  rawTelnyx?: Record<string, unknown>;
  /** Upstream inventory provider for purchase routing. */
  provider?: "telnyx" | "twilio";
  providerReference?: string | null;
};

export type TelnyxSearchAttempt = {
  provider?: "telnyx" | "twilio";
  areaCode?: string;
  strategy: string;
  query: Record<string, string | number>;
  resultCount: number;
  status: "ok" | "error" | "unsupported";
  error?: string;
};

export type PremiumSearchStatistics = {
  telnyxSearchesAttempted: number;
  telnyxSearchesSucceeded: number;
  telnyxSearchesFailed: number;
  rawCandidates: number;
  uniqueCandidates: number;
  scored60Plus: number;
  scored70Plus: number;
  scored80Plus: number;
  scored90Plus: number;
  highestScore: number;
  averageScore: number;
  matchedKeywords: string[];
  tierCounts: Record<QualityTier, number>;
};

import type { KeywordMatchStyle } from "./telnyx-inventory-search";

export type PremiumSearchInput = {
  areaCode: string;
  industry?: string;
  customKeywords?: string[];
  primaryKeywords?: string[];
  limit?: number;
  matchStyle?: KeywordMatchStyle;
  areaCodes?: string[];
};

export type PremiumSearchResult = {
  status: PremiumSearchStatus;
  areaCode: string;
  industry?: string;
  keywords: KeywordEntry[];
  candidates: ScoredCandidate[];
  statistics: PremiumSearchStatistics;
  searchAttempts: TelnyxSearchAttempt[];
  /** Raw upstream attempts (Telnyx + Twilio) for ops logs / DB audit. */
  providerAttempts?: ProviderSearchAttempt[];
  message?: string;
};
