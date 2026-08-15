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

export type KeywordEntry = {
  word: string;
  digits: string;
  /** Primary industry synonym for the active search. */
  isPrimary: boolean;
  /** Secondary industry synonym. */
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

export type ScoredCandidate = {
  phoneNumber: string;
  formattedNumber: string;
  /** Blended overall score (70% business + 30% number quality). */
  score: number;
  tier: QualityTier;
  /** Business / industry word relevance (0–100). */
  businessMatchScore: number;
  /** Generic numeric memorability (0–100). */
  numberQualityScore: number;
  matchedWords: string[];
  matchedPatterns: string[];
  reasons: ScoringReason[];
  businessReasons: ScoringReason[];
  numberQualityReasons: ScoringReason[];
  telnyxCost?: TelnyxCost;
  rawDigits: string;
  subscriberDigits: string;
  rawTelnyx?: Record<string, unknown>;
};

export type TelnyxSearchAttempt = {
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

export type PremiumSearchInput = {
  areaCode: string;
  industry?: string;
  customKeywords?: string[];
  limit?: number;
};

export type PremiumSearchResult = {
  status: PremiumSearchStatus;
  areaCode: string;
  industry?: string;
  keywords: KeywordEntry[];
  candidates: ScoredCandidate[];
  statistics: PremiumSearchStatistics;
  searchAttempts: TelnyxSearchAttempt[];
  message?: string;
};
