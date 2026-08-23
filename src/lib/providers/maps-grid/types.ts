import type { MapsLiveResult } from "@/lib/providers/dataforseo";
import type { MapsFailureCategory } from "@/lib/providers/maps-grid/failure-categories";

export type MapsProviderId = "brightdata" | "dataforseo" | "scrapingdog";

export type MapsRecoveryStage =
  | "scanning_brightdata"
  | "brightdata_degraded"
  | "testing_provider_recovery"
  | "fallback_dataforseo"
  | "fallback_scrapingdog"
  | "finalizing"
  | "completed"
  | "completed_with_unresolved";

export type MapsProviderAttempt = {
  provider: MapsProviderId;
  attemptNumber: number;
  success: boolean;
  category: MapsFailureCategory;
  latencyMs: number;
  httpStatus?: number | null;
  requestId?: string | null;
  errorMessage?: string | null;
  diagnostics?: Record<string, unknown> | null;
};

export type CanonicalMapsCellResult = {
  provider: MapsProviderId;
  providerRequestId?: string | null;
  keyword: string;
  latitude: number;
  longitude: number;
  device: string;
  language: string;
  country: string;
  items: MapsLiveResult[];
  rawRequest: Record<string, unknown>;
  responseTimestamp: string;
};

export type MapsCellFetchSuccess = {
  ok: true;
  items: MapsLiveResult[];
  request: Record<string, unknown>;
  timestamp: string;
  primaryProvider: MapsProviderId;
  finalProvider: MapsProviderId;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  attempts: MapsProviderAttempt[];
  providerLatencyMs: number;
};

export type MapsCellFetchFailure = {
  ok: false;
  unresolvedReason: "provider_unresolved";
  primaryProvider: MapsProviderId;
  finalProvider: MapsProviderId | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  attempts: MapsProviderAttempt[];
  lastCategory: MapsFailureCategory;
  lastErrorMessage: string;
  providerLatencyMs: number;
};

export type MapsCellFetchResult = MapsCellFetchSuccess | MapsCellFetchFailure;

export type MapsCircuitState = "closed" | "degraded" | "open" | "half_open";
