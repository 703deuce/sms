import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/**
 * Where new MCTB customers land for first-run setup.
 * Stage 2: Overview (`/mctb`) with modal wizard — not a standalone onboarding page.
 */
export function mctbOnboardingEntryPath(): string {
  return isNewUiStage2Enabled() ? MCTB_ROUTES.home : "/onboarding/mctb";
}

/** Signup / marketing links — preserves product intent when needed. */
export function mctbSignupNextQuery(): string {
  const next = encodeURIComponent(mctbOnboardingEntryPath());
  return `/signup?next=${next}`;
}

export function isMctbOnboardingLegacyFullPagePath(pathname: string): boolean {
  return pathname === "/onboarding/mctb" || pathname.startsWith("/onboarding/mctb/");
}

/**
 * Stage 2 modal onboarding: normalize legacy full-page targets to `/mctb`.
 */
export function normalizeMctbOnboardingPostLoginPath(path: string): string {
  if (!isNewUiStage2Enabled()) return path;
  if (path === "/onboarding/mctb" || path.startsWith("/onboarding/mctb/")) {
    return MCTB_ROUTES.home;
  }
  return path;
}
