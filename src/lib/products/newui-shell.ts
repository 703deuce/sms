import { isMctbUniversalChromeActive } from "@/lib/mctb/universal-shell";
import { isAppointmentsProductPath } from "@/lib/products/appointments-routes";
import type { ProductShell } from "@/lib/products/product-shell";
import {
  isAppointmentRemindersV1Primary,
  isAppointmentsV1Primary,
} from "@/lib/workspace/platform-launch";
import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";

/** Scheduling product uses Opus chrome on all platform routes (not only when UNIFIED_APPOINTMENTS=1). */
export function isSchedulingOpusChromePath(pathname: string): boolean {
  if (pathname.startsWith("/appointment-reminders")) return true;
  if (isAppointmentsProductPath(pathname)) return true;
  const schedulingLaunch =
    isUnifiedAppointmentsExperience() ||
    isAppointmentRemindersV1Primary() ||
    isAppointmentsV1Primary();
  if (!schedulingLaunch) return false;
  return (
    pathname.startsWith("/meetings") ||
    pathname.startsWith("/video") ||
    pathname.startsWith("/payments")
  );
}

/**
 * New UI shell rollout — presentation transplant only (Category A/B/C rules).
 * Set NEXT_PUBLIC_NEWUI_SHELL=0 to disable without redeploying logic.
 */
export function isNewUiShellEnabled(): boolean {
  return process.env.NEXT_PUBLIC_NEWUI_SHELL !== "0";
}

function isLegacyAutomationFullBleed(pathname: string): boolean {
  if (pathname.startsWith("/automations/drip-campaigns") || pathname.startsWith("/drip-campaigns")) {
    return false;
  }
  return pathname.startsWith("/automations");
}

/** When true, AppShell renders newui-style sidebar + topbar; page body unchanged (Category C). */
export function shouldUseNewUiShell(
  pathname: string,
  options: {
    realtorMode?: boolean;
    isLauncher?: boolean;
    productShell: ProductShell;
    hasMctb?: boolean;
  },
): boolean {
  if (!isNewUiShellEnabled()) return false;
  if (options.realtorMode) return false;
  if (options.isLauncher) return false;
  if (isLegacyAutomationFullBleed(pathname)) return false;
  if (pathname === "/app" || pathname.startsWith("/app/")) return false;

  if (isMctbUniversalChromeActive(pathname, options.productShell, { hasMctb: options.hasMctb })) {
    return true;
  }

  if (pathname.startsWith("/voice/")) return true;
  if (pathname.startsWith("/mctb/") || pathname === "/mctb") return true;
  if (isSchedulingOpusChromePath(pathname)) return true;
  if (pathname === "/integrations" || pathname.startsWith("/integrations/")) return true;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return true;

  return false;
}
