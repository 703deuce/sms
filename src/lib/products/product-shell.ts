/**
 * Transovo product shells — Mass SMS marketing vs Missed Call Text Back.
 * Top tabs switch shell context; ambiguous routes follow the last selected shell.
 */

export type ProductShell = "mass_sms" | "mctb";

export const PRODUCT_SHELL_STORAGE_KEY = "transovo.activeProductShell";
export const PRODUCT_SWITCHER_ONBOARDING_KEY = "transovo.productSwitcherOnboarding.v1";

const MCTB_PATH_PREFIXES = [
  "/voice",
  "/smart-routing",
  "/call-forwarding",
  "/onboarding/mctb",
] as const;

const MASS_SMS_PATH_PREFIXES = [
  "/campaigns",
  "/playbooks",
  "/send",
  "/sms",
  "/automations",
  "/grow",
  "/reports",
  "/dashboard",
] as const;

export function massSmsShellHome(): string {
  return "/dashboard";
}

export function mctbShellHome(): string {
  return "/voice/missed-calls";
}

export function productShellLabel(shell: ProductShell): string {
  return shell === "mass_sms" ? "Mass SMS Platform" : "Missed Call Engine";
}

export function productShellShortLabel(shell: ProductShell): string {
  return shell === "mass_sms" ? "Mass SMS" : "Missed Calls";
}

export function isExplicitMctbShellPath(pathname: string): boolean {
  return MCTB_PATH_PREFIXES.some(
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
  if (isExplicitMassSmsShellPath(pathname)) return "mass_sms";
  return null;
}

export function readStoredProductShell(): ProductShell | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRODUCT_SHELL_STORAGE_KEY);
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
}): ProductShell {
  if (input.hasMassSms && !input.hasMctb) return "mass_sms";
  if (input.hasMctb && !input.hasMassSms) return "mctb";
  return "mass_sms";
}

export function shellHomePath(shell: ProductShell): string {
  return shell === "mass_sms" ? massSmsShellHome() : mctbShellHome();
}
