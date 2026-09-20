export type BusinessImportStatus =
  | "QUEUED"
  | "DISCOVERING"
  | "FETCHING"
  | "EXTRACTING"
  | "COMPARING"
  | "REVIEW_READY"
  | "APPLIED"
  | "PARTIAL"
  | "FAILED";

export type BusinessImportTrigger =
  | "onboarding"
  | "refresh"
  | "website_only"
  | "google_only";

export type CandidateSourceType = "WEBSITE" | "GOOGLE_MAPS" | "JSON_LD";

export type FactProvenance = {
  sourceType: CandidateSourceType;
  sourceUrl?: string;
  sourceLabel?: string;
  evidence?: string;
  confidence: "high" | "medium" | "low";
};

export type DiffClassification =
  | "NEW"
  | "EXACT_DUPLICATE"
  | "SEMANTIC_DUPLICATE"
  | "CHANGED"
  | "CONFLICT"
  | "UNCHANGED"
  | "LOW_CONFIDENCE";

export type ReviewCandidate = {
  id: string;
  fieldPath: string;
  category: string;
  label: string;
  currentValue?: string | null;
  proposedValue: string;
  classification: DiffClassification;
  provenance: FactProvenance;
  selectedByDefault: boolean;
  semanticMatchId?: string;
};

export type BusinessImportTelemetry = {
  directPagesFetched: number;
  scrapingDogStatic: number;
  scrapingDogDynamic: number;
  googleMapsRequests: number;
  llmCalls: number;
  pagesProcessed: number;
  durationMs?: number;
  acquisitionByUrl?: Record<string, ScrapingDogFetchModeLabel>;
};

export type ScrapingDogFetchModeLabel = "DIRECT" | "SCRAPINGDOG_STATIC" | "SCRAPINGDOG_DYNAMIC";

export type ImportPageSnapshot = {
  url: string;
  title?: string;
  contentHash: string;
  cleanedText: string;
  fetchedAt: string;
  acquisition: ScrapingDogFetchModeLabel;
};

export type BusinessExtractionCandidate = {
  business?: {
    name?: string;
    description?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
  hoursProse?: string;
  services?: Array<{ name: string; description?: string; provenance: FactProvenance }>;
  serviceAreas?: Array<{ name: string; provenance: FactProvenance }>;
  faqs?: Array<{ question: string; answer: string; provenance: FactProvenance }>;
  pricing?: Array<{ label: string; value: string; provenance: FactProvenance }>;
  policies?: Array<{ label: string; value: string; provenance: FactProvenance }>;
  emergency?: { offered?: boolean | null; details?: string | null; provenance?: FactProvenance };
  extraKnowledge?: Array<{ topic: string; content: string; provenance: FactProvenance }>;
};
