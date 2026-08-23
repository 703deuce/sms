/**
 * Canonical Maps provider failure categories for Bright Data / DataForSEO / ScrapingDog.
 */

export const MAPS_FAILURE_CATEGORIES = [
  "success",
  "http_429",
  "http_502",
  "http_503",
  "http_504",
  "provider_timeout",
  "empty_body",
  "invalid_json",
  "unexpected_schema",
  "provider_error_payload",
  "google_consent_page",
  "google_challenge",
  "google_unusual_traffic",
  "valid_empty_maps_results",
  "sparse_maps_results",
  "invalid_request",
  "authentication_error",
  "authorization_error",
  "quota_exhausted",
  "permanent_error",
  "capacity_timeout",
  "circuit_open",
  "provider_unavailable",
  "unknown",
] as const;

export type MapsFailureCategory = (typeof MAPS_FAILURE_CATEGORIES)[number];

const TRANSIENT: ReadonlySet<MapsFailureCategory> = new Set([
  "http_429",
  "http_502",
  "http_503",
  "http_504",
  "provider_timeout",
  "empty_body",
  "invalid_json",
  "unexpected_schema",
  "provider_error_payload",
  "google_consent_page",
  "google_challenge",
  "google_unusual_traffic",
  "capacity_timeout",
  // sparse can be transient under provider degradation
  "sparse_maps_results",
]);

const DEGRADATION_PATTERNS: ReadonlySet<MapsFailureCategory> = new Set([
  "http_502",
  "http_503",
  "http_504",
  "provider_timeout",
  "empty_body",
  "invalid_json",
  "unexpected_schema",
  "google_consent_page",
  "google_challenge",
  "google_unusual_traffic",
]);

export function isTransientMapsFailure(category: MapsFailureCategory): boolean {
  return TRANSIENT.has(category);
}

export function isProviderDegradationPattern(category: MapsFailureCategory): boolean {
  return DEGRADATION_PATTERNS.has(category);
}

export function isPermanentMapsFailure(category: MapsFailureCategory): boolean {
  return (
    category === "invalid_request" ||
    category === "authentication_error" ||
    category === "authorization_error" ||
    category === "quota_exhausted" ||
    category === "permanent_error"
  );
}

/** Map legacy Bright Data categories into the shared taxonomy. */
export function fromBrightDataCategory(category: string): MapsFailureCategory {
  switch (category) {
    case "http_error":
      return "http_502";
    case "provider_timeout":
      return "provider_timeout";
    case "empty_body":
      return "empty_body";
    case "invalid_json":
      return "invalid_json";
    case "unexpected_schema":
      return "unexpected_schema";
    case "google_consent_page":
      return "google_consent_page";
    case "google_challenge":
      return "google_challenge";
    case "provider_error_payload":
      return "provider_error_payload";
    case "empty_maps_results":
      // Legacy string collapsed empty-body + real empty SERP. Prefer empty_body
      // unless diagnostics prove a valid empty organic collection.
      return "empty_body";
    case "sparse_maps_results":
      return "sparse_maps_results";
    case "html_or_wrong_zone":
      return "unexpected_schema";
    case "capacity_timeout":
      return "capacity_timeout";
    case "circuit_open":
      return "circuit_open";
    default:
      return "unknown";
  }
}

export function categoryFromHttpStatus(status: number): MapsFailureCategory {
  if (status === 429) return "http_429";
  if (status === 502) return "http_502";
  if (status === 503) return "http_503";
  if (status === 504) return "http_504";
  if (status === 401) return "authentication_error";
  if (status === 403) return "authorization_error";
  if (status === 402) return "quota_exhausted";
  if (status >= 400 && status < 500) return "invalid_request";
  if (status >= 500) return "http_502";
  return "unknown";
}

export function classifyErrorMessage(message: string): MapsFailureCategory {
  const msg = message.toLowerCase();
  if (msg.includes("capacity timeout")) return "capacity_timeout";
  if (msg.includes("circuit open")) return "circuit_open";
  if (msg.includes("timeout")) return "provider_timeout";
  if (msg.includes("429") || msg.includes("rate limit")) return "http_429";
  if (msg.includes("504")) return "http_504";
  if (msg.includes("503")) return "http_503";
  if (msg.includes("502")) return "http_502";
  if (msg.includes("consent")) return "google_consent_page";
  if (msg.includes("unusual traffic")) return "google_unusual_traffic";
  if (msg.includes("captcha") || msg.includes("challenge")) return "google_challenge";
  if (msg.includes("empty body") || msg.includes("zero bytes")) return "empty_body";
  if (msg.includes("invalid json")) return "invalid_json";
  if (msg.includes("sparse serp") || msg.includes("target-only")) return "sparse_maps_results";
  if (msg.includes("no map results") && msg.includes("organic")) return "valid_empty_maps_results";
  if (msg.includes("no map results") || msg.includes("empty")) return "empty_body";
  if (msg.includes("unauthorized") || msg.includes("api key")) return "authentication_error";
  if (msg.includes("forbidden")) return "authorization_error";
  if (msg.includes("quota") || msg.includes("credits")) return "quota_exhausted";
  if (msg.includes("credentials") || msg.includes("not configured")) return "provider_unavailable";
  return "unknown";
}
