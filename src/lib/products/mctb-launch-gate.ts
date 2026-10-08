import "server-only";

import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { isExplicitMctbShellPath } from "@/lib/products/product-shell";
import { isAppointmentRemindersV1Primary } from "@/lib/workspace/platform-launch";

/** Customer-facing MCTB onboarding (frozen during AR-only launch). */
const MCTB_ONBOARDING_PREFIXES = ["/onboarding/mctb"] as const;

const MCTB_LEGACY_VOICE_PREFIXES = [
  "/voice/missed-calls",
  "/voice/setup",
  "/voice/consent-log",
  "/voice/try-it",
  "/voice/schedule",
  "/voice/voicemail",
  "/voice/analytics",
  "/voice/numbers",
  "/voice/reports",
  "/voice/conversations",
] as const;

export function isMctbCustomerUiPath(pathname: string): boolean {
  if (!isAppointmentRemindersV1Primary()) return false;
  if (isExplicitMctbShellPath(pathname)) return true;
  return MCTB_ONBOARDING_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isMctbCustomerUiPathIncludingLegacyVoice(pathname: string): boolean {
  if (!isAppointmentRemindersV1Primary()) return false;
  if (isMctbCustomerUiPath(pathname)) return true;
  return MCTB_LEGACY_VOICE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Redirect target when a normal customer hits a frozen MCTB UI route. */
export function appointmentRemindersCustomerLandingPath(): string {
  return AR_ROUTES.home;
}

export function appointmentRemindersSetupPath(): string {
  return AR_ROUTES.setupConnect;
}
