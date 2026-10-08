import { normalizeMctbOnboardingPostLoginPath } from "@/lib/mctb/onboarding/entry-path";
import { normalizeAppointmentsPostLoginPath } from "@/lib/products/appointments-home-redirect";
import {
  appointmentRemindersProductShellHome,
  mctbShellHome,
} from "@/lib/products/product-shell";
import {
  isAppointmentRemindersV1Primary,
  isMctbV1Primary,
} from "@/lib/workspace/platform-launch";

/** Client-side navigation after login/signup — API routes need full page loads. */
export function navigateAfterAuth(
  path: string,
  router: { push: (href: string) => void; refresh: () => void },
): void {
  const target = path.trim() || "/dashboard";
  if (target.startsWith("/api/")) {
    window.location.assign(target);
    return;
  }
  router.push(target);
  router.refresh();
}

/** Paths safe for client router.push (not API routes or auth pages). */
export function defaultAuthLandingPath(): string {
  if (isAppointmentRemindersV1Primary()) return appointmentRemindersProductShellHome();
  if (isMctbV1Primary()) return mctbShellHome();
  return "/dashboard";
}

export function clientSafeNextPath(path: string | null | undefined, fallback?: string): string {
  const landing = fallback ?? defaultAuthLandingPath();
  if (!path?.trim()) return landing;
  if (!path.startsWith("/") || path.startsWith("//")) return landing;
  if (path.startsWith("/login") || path.startsWith("/signup")) return landing;
  if (path.startsWith("/api/")) return landing;
  return normalizeMctbOnboardingPostLoginPath(normalizeAppointmentsPostLoginPath(path));
}

/** Voice product signup should open workspace via server redirect route. */
export function voiceProductOpenPath(): string {
  return "/api/products/open?product=voice";
}
