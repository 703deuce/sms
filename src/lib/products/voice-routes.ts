/**
 * AI Receptionist (voice) product route map — primary launch product surface.
 */

/** Core AI Receptionist app prefixes (sidebar + deep voice routes). */
export const VOICE_APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/outcomes",
  "/voice",
  "/inbox",
  "/integrations",
  "/settings",
  "/getting-started",
  "/contact",
  "/company-brain",
] as const;

/** Legacy/hidden routes that keep voice chrome but are not in primary nav. */
export const VOICE_DEEP_ROUTE_PREFIXES = [
  "/automations",
  "/smart-routing",
  "/phone",
  "/agents",
  "/hire",
  "/outcomes",
  "/systems",
  "/compliance",
  "/solutions",
  "/realtor",
] as const;

/** SMS standalone routes — hidden from primary nav but preserved in codebase. */
export const SMS_HIDDEN_ROUTE_PREFIXES = [
  "/send",
  "/campaigns",
  "/contacts",
  "/grow",
  "/templates",
  "/surveys",
  "/reports",
  "/numbers",
  "/messaging",
  "/my-numbers",
] as const;

export function isVoiceShellRoute(pathname: string): boolean {
  if (pathname.startsWith("/personal")) return false;
  if (SMS_HIDDEN_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  return VOICE_APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isMctbAppPath(pathname: string): boolean {
  if (pathname === "/onboarding/mctb" || pathname.startsWith("/onboarding/mctb/")) {
    return true;
  }
  if (pathname === "/voice/try-it" || pathname.startsWith("/voice/try-it/")) {
    return true;
  }
  if (pathname === "/voice/setup" || pathname.startsWith("/voice/setup/")) {
    return true;
  }
  if (pathname === "/voice/missed-calls" || pathname.startsWith("/voice/missed-calls/")) {
    return true;
  }
  return false;
}

export function isVoiceProductPath(pathname: string): boolean {
  if (isMctbAppPath(pathname)) {
    return true;
  }
  if (pathname.startsWith("/personal")) return false;
  if (pathname.startsWith("/numbers/premium") || pathname.startsWith("/numbers/pools")) {
    return false;
  }
  if (pathname === "/app" || pathname.startsWith("/app/")) return false;
  if (isVoiceShellRoute(pathname)) return true;
  return VOICE_DEEP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
