/**
 * Temporary dev/cert auth bypass — NOT for production without explicit env opt-in.
 * Remove DEV_AUTH_BYPASS from env when Google login is re-enabled.
 */
import { certBrowserRequestHost, isCertBrowserPublicProductionHost } from "@/lib/auth/cert-browser-host";

export const DEV_AUTH_BYPASS_ENV = "DEV_AUTH_BYPASS";

export function isDevAuthBypassEnabled(): boolean {
  const raw = process.env[DEV_AUTH_BYPASS_ENV]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Default owner account for browser certification (Google OAuth — no password). */
export function devAuthBypassEmailHint(): string {
  return (process.env.DEV_AUTH_BYPASS_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
}

export function devAuthBypassAllowedOnHost(host: string): boolean {
  if (!isDevAuthBypassEnabled()) return false;
  // When DEV_AUTH_BYPASS=1, allow localhost and transovo.ai (cert / owner account).
  if (!isCertBrowserPublicProductionHost(host)) return true;
  return true;
}

export function devAuthBypassAllowed(request: Request): boolean {
  return devAuthBypassAllowedOnHost(certBrowserRequestHost(request));
}

export function safeDevBypassNextPath(raw: string | null): string {
  const next = (raw || "/dashboard").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return "/dashboard";
  }
  return next;
}
