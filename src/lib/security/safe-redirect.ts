import { URL } from "url";

const GOOGLE_REVIEW_HOSTS = new Set([
  "g.page",
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
  "search.google.com",
  "business.google.com",
]);

/**
 * Allow only http(s) review / tracking redirect targets.
 * Blocks javascript:, data:, and private/internal hosts.
 */
export function isAllowedExternalRedirect(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost")
  ) {
    return false;
  }
  // Prefer known Google review hosts; also allow other public https hosts
  // that businesses commonly use for review landing pages.
  if (GOOGLE_REVIEW_HOSTS.has(host)) return true;
  if (host.endsWith(".google.com") || host.endsWith(".goo.gl") || host.endsWith(".g.page")) {
    return true;
  }
  // Generic https only (no http) for non-Google destinations.
  return parsed.protocol === "https:";
}

export function sanitizeReviewRedirectUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!isAllowedExternalRedirect(trimmed)) return null;
  return trimmed;
}
