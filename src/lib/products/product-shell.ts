/**
 * Transovo product shells — SMS, Missed Call Text Back, and AI After Hours.
 * Top switcher swaps shell context; ambiguous routes follow the last selected shell.
 */
import { isSmsOnlyAppNav } from "@/lib/workspace/platform-launch";

export type ProductShell = "mass_sms" | "mctb" | "ai_after_hours";

export const PRODUCT_SHELL_STORAGE_KEY = "transovo.activeProductShell";
export const PRODUCT_SWITCHER_ONBOARDING_KEY = "transovo.productSwitcherOnboarding.v2";

const MCTB_PATH_PREFIXES = [
  "/voice/missed-calls",
  "/voice/setup",
  "/voice/consent-log",
  "/voice/try-it",
  "/voice/schedule",
  "/voice/voicemail",
  "/smart-routing",
  "/call-forwarding",
  "/onboarding/mctb",
] as const;

const AI_AFTER_HOURS_PATH_PREFIXES = [
  "/voice/overview",
  "/voice/agents",
  "/voice/calls",
  "/voice/knowledge",
  "/voice/inbound-routing",
  "/voice/setup",
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
  "/dashboard",
] as const;

export function massSmsShellHome(): string {
  return "/dashboard";
}

export function mctbShellHome(): string {
  // INTERIM until Spec 01 Overview ships — then change to "/mctb" (see docs/MCTB-FRONTEND-REBUILD-KICKOFF.md)
  return "/voice/missed-calls";
}

export function aiAfterHoursShellHome(): string {
  return "/voice/overview";
}

export function productShellLabel(shell: ProductShell): string {
  switch (shell) {
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

export function isExplicitAiAfterHoursShellPath(pathname: string): boolean {
  return AI_AFTER_HOURS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isExplicitMassSmsShellPath(pathname: string): boolean {
  if (pathname === "/conversations" || pathname.startsWith("/conversations/")) {
    return true;
  }
  if (pathname === "/contacts" || pathname.startsWith("/contacts/")) {
    return true;
  }
  if (pathname === "/analytics" || pathname.startsWith("/analytics/")) {
    return true;
  }
  return MASS_SMS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Path implies a shell, or null when shared/ambiguous (settings, compliance, etc.). */
export function resolveProductShellFromPath(pathname: string): ProductShell | null {
  if (isExplicitMctbShellPath(pathname)) return "mctb";
  if (isExplicitAiAfterHoursShellPath(pathname)) return "ai_after_hours";
  if (isExplicitMassSmsShellPath(pathname)) return "mass_sms";
  return null;
}

export function readStoredProductShell(): ProductShell | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRODUCT_SHELL_STORAGE_KEY);
    if (raw === "mass_sms" || raw === "mctb" || raw === "ai_after_hours") return raw;
    // Migrate legacy two-shell storage keys
    if (raw === "mass_sms" || raw === "mctb") return raw;
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
  if (input.hasMassSms) return "mass_sms";
  if (input.hasAiAfterHours) return "ai_after_hours";
  if (input.hasMctb) return "mctb";
  return "mass_sms";
}

export function shellHomePath(shell: ProductShell): string {
  switch (shell) {
    case "mass_sms":
      return massSmsShellHome();
    case "mctb":
      return mctbShellHome();
    case "ai_after_hours":
      return aiAfterHoursShellHome();
    default:
      return massSmsShellHome();
  }
}

export function countEntitledProductShells(input: {
  hasMctb: boolean;
  hasMassSms: boolean;
  hasAiAfterHours: boolean;
}): number {
  return [input.hasMassSms, input.hasMctb, input.hasAiAfterHours].filter(Boolean).length;
}

export function shouldShowProductSwitcher(input: {
  hasMctb: boolean;
  hasMassSms: boolean;
  hasAiAfterHours: boolean;
}): boolean {
  if (isSmsOnlyAppNav()) return false;
  return countEntitledProductShells(input) >= 2;
}
