import { isAppointmentRemindersSharedWorkspacePath } from "@/lib/products/appointment-reminders-nav";
import { isAppointmentRemindersProductPath } from "@/lib/appointment-reminders/routes";
import { isMctbSharedWorkspacePath } from "@/lib/products/mctb-nav";
import { isMctbBundledAiReceptionistPath } from "@/lib/products/mctb-bundled-receptionist-paths";
import { isMctbNeutralShellPath } from "@/lib/products/mctb-shell";
import type { ProductShell } from "@/lib/products/product-shell";
import { resolveProductShellFromPath } from "@/lib/products/product-shell";
import { isBusinessMessagingUnifiedNav, isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { isBusinessMessagingSharedShellPath } from "@/lib/products/business-messaging-nav";

const MCTB_CHROME_EXCLUDED_PREFIXES = [
  "/login",
  "/signup",
  "/maintenance",
  "/f/",
  "/book/",
  "/pay/",
] as const;

/** Routes that never use the MCTB admin chrome (public / auth). */
export function isMctbChromeExcludedPath(pathname: string): boolean {
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  return MCTB_CHROME_EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

/** True when the universal MCTB sidebar/header/canvas should render. */
export function isMctbUniversalChromeActive(
  pathname: string,
  productShell: ProductShell,
  options?: { hasMctb?: boolean },
): boolean {
  if (isMctbChromeExcludedPath(pathname)) return false;
  if (isBusinessMessagingUnifiedNav() && isBusinessMessagingSharedShellPath(pathname)) {
    return true;
  }
  if (isMctbNeutralShellPath(pathname)) return true;
  if (isAppointmentRemindersProductPath(pathname)) return true;
  if (productShell === "mctb" && isMctbSharedWorkspacePath(pathname)) return true;
  if (
    productShell === "appointment_reminders" &&
    isAppointmentRemindersSharedWorkspacePath(pathname)
  ) {
    return true;
  }
  if (isMctbV1Primary() && options?.hasMctb !== false) {
    if (isMctbBundledAiReceptionistPath(pathname)) return true;
    const pathShell = resolveProductShellFromPath(pathname);
    if (pathShell === "mass_sms" || pathShell === "ai_after_hours") return false;
    if (pathShell === "appointments") return false;
    if (pathShell === "appointment_reminders") return false;
    if (productShell === "appointment_reminders") {
      return isAppointmentRemindersSharedWorkspacePath(pathname);
    }
    return productShell === "mctb";
  }
  return false;
}

/** Effective product shell for nav when launch mode is MCTB-first. */
export function resolveMctbLaunchProductShell(
  pathname: string,
  productShell: ProductShell,
  hasMctb: boolean,
): ProductShell | null {
  if (isMctbV1Primary() && hasMctb && isMctbBundledAiReceptionistPath(pathname)) {
    return "mctb";
  }
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell) return pathShell;
  if (!hasMctb) return null;
  if (isMctbSharedWorkspacePath(pathname) && productShell === "mctb") return "mctb";
  if (isMctbV1Primary()) return "mctb";
  return null;
}
