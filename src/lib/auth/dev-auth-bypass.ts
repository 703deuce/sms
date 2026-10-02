/**
 * Temporary dev/cert auth bypass — NOT for production without explicit env opt-in.
 * Remove DEV_AUTH_BYPASS from env when Google login is re-enabled.
 */
import { certBrowserRequestHost, isCertBrowserPublicProductionHost } from "@/lib/auth/cert-browser-host";
import { normalizeAppointmentsPostLoginPath } from "@/lib/products/appointments-home-redirect";

export const DEV_AUTH_BYPASS_ENV = "DEV_AUTH_BYPASS";
export const DEV_AUTH_BYPASS_2_ENV = "DEV_AUTH_BYPASS_2";

function envTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isDevAuthBypassEnabled(): boolean {
  return envTruthy(process.env[DEV_AUTH_BYPASS_ENV]);
}

/** Isolated fresh-customer MCTB cert lane — authentication only. */
export function isDevAuthBypass2Enabled(): boolean {
  return envTruthy(process.env[DEV_AUTH_BYPASS_2_ENV]);
}

/** Default owner account for browser certification (Google OAuth — no password). */
export function devAuthBypassEmailHint(): string {
  return (process.env.DEV_AUTH_BYPASS_EMAIL || "[REDACTED]").trim().toLowerCase();
}

/** Second cert identity for fresh MCTB onboarding (must not be bypass 1 email). */
export function devAuthBypass2EmailHint(): string {
  return (
    process.env.DEV_AUTH_BYPASS_2_EMAIL || "mctb-fresh-cert@transovo.test"
  )
    .trim()
    .toLowerCase();
}

/** Workspaces bypass 2 must never attach to (default production cert ws_1). */
export function devAuthBypass2ForbiddenWorkspaceIds(): string[] {
  const fromEnv = process.env.DEV_AUTH_BYPASS_2_FORBIDDEN_WORKSPACE_IDS?.trim();
  if (fromEnv) {
    return fromEnv.split(/[\s,]+/).filter(Boolean);
  }
  const ws1 = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim();
  return ws1 ? [ws1] : ["ws_1"];
}

function certBypassHostAllowed(host: string): boolean {
  if (!isCertBrowserPublicProductionHost(host)) return true;
  return true;
}

export function devAuthBypassAllowedOnHost(host: string): boolean {
  if (!isDevAuthBypassEnabled()) return false;
  return certBypassHostAllowed(host);
}

export function devAuthBypass2AllowedOnHost(host: string): boolean {
  if (!isDevAuthBypass2Enabled()) return false;
  return certBypassHostAllowed(host);
}

export function devAuthBypassAllowed(request: Request): boolean {
  return devAuthBypassAllowedOnHost(certBrowserRequestHost(request));
}

export function devAuthBypass2Allowed(request: Request): boolean {
  return devAuthBypass2AllowedOnHost(certBrowserRequestHost(request));
}

export function safeDevBypassNextPath(raw: string | null): string {
  const next = (raw || "/dashboard").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return "/dashboard";
  }
  return normalizeAppointmentsPostLoginPath(next);
}
