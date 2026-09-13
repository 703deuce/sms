/**
 * Transovo product shells — separate product contexts within one application shell.
 * V1 launch: Appointments + Missed Call Text Back (SMS marketing is infrastructure, not a nav product).
 */
import { appointmentsShellHome } from "@/lib/products/appointments-routes";
import { isAppointmentsMessagesPath } from "@/lib/products/appointments-messages-routes";
import {
  isSmsOnlyAppNav,
  isAppointmentsV1Primary,
  isMctbV1Primary,
  isSmsStandaloneHidden,
} from "@/lib/workspace/platform-launch";

export type ProductShell = "appointments" | "mass_sms" | "mctb" | "ai_after_hours";

export const PRODUCT_SHELL_STORAGE_KEY = "transovo.activeProductShell";
export const PRODUCT_SWITCHER_ONBOARDING_KEY = "transovo.productSwitcherOnboarding.v3";

const MCTB_PATH_PREFIXES = [
  "/voice/missed-calls",
  "/voice/setup",
  "/voice/consent-log",
  "/voice/try-it",
  "/voice/schedule",
  "/voice/voicemail",
  "/voice/analytics",
  "/voice/numbers",
  "/voice/reports",
  "/onboarding/mctb",
  "/analytics/mctb",
  "/mctb",
  "/mctb/calendar",
  "/mctb/appointments",
  "/mctb/booking",
  "/mctb/reminders",
] as const;

const AI_AFTER_HOURS_PATH_PREFIXES = [
  "/voice/overview",
  "/voice/agents",
  "/voice/calls",
  "/voice/knowledge",
  "/voice/inbound-routing",
  "/voice/receptionist",
] as const;

const MASS_SMS_PATH_PREFIXES = [
  "/campaigns",
  "/playbooks",
  "/send",
  "/sms",
  "/automations",
  "/auto-replies",
  "/drip-campaigns",
  "/ai-replies",
  "/grow",
  "/reports",
] as const;

/** Appointments-only paths — shared routes like /settings resolve via stored shell. */
const APPOINTMENTS_PATH_PREFIXES = [
  "/appointments",
  "/meetings",
  "/video",
] as const;

export function massSmsShellHome(): string {
  return "/dashboard";
}

export function mctbShellHome(): string {
  return "/mctb";
}

export function aiAfterHoursShellHome(): string {
  return "/voice/overview";
}

export function appointmentsProductShellHome(): string {
  return appointmentsShellHome();
}

export function productShellLabel(shell: ProductShell): string {
  switch (shell) {
    case "appointments":
      return "Appointments";
    case "mass_sms":
      return "SMS";
    case "mctb":
      return "Missed Call Text Back";
    case "ai_after_hours":
      return "AI After Hours";
    default:
      return "Transovo";
  }
}

export function productShellShortLabel(shell: ProductShell): string {
  switch (shell) {
    case "appointments":
      return "Appointments";
    case "mass_sms":
      return "SMS";
    case "mctb":
      return "MCTB";
    case "ai_after_hours":
      return "AI After Hours";
    default:
      return "Transovo";
  }
}

export function isExplicitMctbShellPath(pathname: string): boolean {
  return MCTB_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isExplicitAppointmentsShellPath(pathname: string): boolean {
  if (
    isAppointmentsV1Primary() &&
    isAppointmentsMessagesPath(pathname)
  ) {
    return true;
  }
  return APPOINTMENTS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isExplicitAiAfterHoursShellPath(pathname: string): boolean {
  return AI_AFTER_HOURS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isExplicitMassSmsShellPath(pathname: string): boolean {
  return MASS_SMS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Path implies a shell, or null when shared/ambiguous (settings, compliance, etc.). */
export function resolveProductShellFromPath(pathname: string): ProductShell | null {
  if (isExplicitMctbShellPath(pathname)) return "mctb";
  if (isExplicitAppointmentsShellPath(pathname)) return "appointments";
  if (isExplicitAiAfterHoursShellPath(pathname)) return "ai_after_hours";
  if (isExplicitMassSmsShellPath(pathname)) return "mass_sms";
  return null;
}

export function readStoredProductShell(): ProductShell | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRODUCT_SHELL_STORAGE_KEY);
    if (
      raw === "appointments" ||
      raw === "mass_sms" ||
      raw === "mctb" ||
      raw === "ai_after_hours"
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
}

export function writeStoredProductShell(shell: ProductShell): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRODUCT_SHELL_STORAGE_KEY, shell);
  } catch {
    // ignore
  }
}

export function defaultProductShell(input: {
  hasMctb: boolean;
  hasMassSms: boolean;
  hasAiAfterHours?: boolean;
}): ProductShell {
  if (isMctbV1Primary() && input.hasMctb) return "mctb";
  if (isAppointmentsV1Primary()) return "appointments";
  if (input.hasMassSms) return "mass_sms";
  if (input.hasAiAfterHours) return "ai_after_hours";
  if (input.hasMctb) return "mctb";
  return "appointments";
}

export function shellHomePath(shell: ProductShell): string {
  switch (shell) {
    case "appointments":
      return appointmentsProductShellHome();
    case "mass_sms":
      return massSmsShellHome();
    case "mctb":
      return mctbShellHome();
    case "ai_after_hours":
      return aiAfterHoursShellHome();
    default:
      return appointmentsProductShellHome();
  }
}

export function countEntitledProductShells(input: {
  hasMctb: boolean;
  hasMassSms: boolean;
  hasAiAfterHours: boolean;
}): number {
  return visibleProductShells(input).length;
}

/** Product shells shown in the switcher for the current launch configuration. */
export function visibleProductShells(input: {
  hasMctb: boolean;
  hasMassSms: boolean;
  hasAiAfterHours: boolean;
}): ProductShell[] {
  if (isAppointmentsV1Primary()) {
    const shells: ProductShell[] = ["appointments"];
    if (input.hasMctb) shells.push("mctb");
    return shells;
  }

  const shells: ProductShell[] = [];
  if (input.hasMassSms && !isSmsStandaloneHidden()) shells.push("mass_sms");
  if (input.hasMctb) shells.push("mctb");
  if (input.hasAiAfterHours) shells.push("ai_after_hours");
  return shells;
}

export function shouldShowProductSwitcher(input: {
  hasMctb: boolean;
  hasMassSms: boolean;
  hasAiAfterHours: boolean;
}): boolean {
  if (isSmsOnlyAppNav()) return false;
  /** Appointments V1 launch: hide switcher UI; infrastructure remains for later restore. */
  if (isAppointmentsV1Primary()) return false;
  return visibleProductShells(input).length >= 2;
}
