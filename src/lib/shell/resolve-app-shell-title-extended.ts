import { getPageTitle } from "@/lib/nav";
import { getRealtorPageTitle } from "@/lib/realtor/nav";
import { getNumbersPageTitle } from "@/lib/products/numbers-nav";
import { getAiAfterHoursPageTitle } from "@/lib/products/ai-after-hours-nav";
import { getVoicePageTitle } from "@/lib/products/voice-nav";
import { getSmsPlatformPageTitle } from "@/lib/products/sms-platform-nav";
import { getAppointmentsPageTitle } from "@/lib/products/appointments-nav";
import { isAppointmentsProductPath } from "@/lib/products/appointments-routes";
import { isSmsShellRoute } from "@/lib/products/sms-routes";
import type { AppShellTitleInput } from "@/lib/shell/resolve-app-shell-title";

export function resolveNonMctbAppShellTitle(input: AppShellTitleInput): string {
  const smsPlatformTitle = isSmsShellRoute(input.pathname)
    ? getSmsPlatformPageTitle(input.pathname)
    : "";
  const appointmentsTitle =
    input.appointmentsContextActive && isAppointmentsProductPath(input.pathname)
      ? getAppointmentsPageTitle(input.pathname)
      : "";

  if (appointmentsTitle) return appointmentsTitle;
  if (smsPlatformTitle) return smsPlatformTitle;

  if (input.currentProduct === "numbers") {
    return getNumbersPageTitle(input.pathname);
  }

  if (input.multiProduct && input.productShell === "ai_after_hours") {
    return (
      getAiAfterHoursPageTitle(input.pathname) ||
      getVoicePageTitle(input.pathname) ||
      getSmsPlatformPageTitle(input.pathname)
    );
  }

  if (input.currentProduct === "voice" || input.currentProduct === "sms") {
    return getVoicePageTitle(input.pathname) || getSmsPlatformPageTitle(input.pathname);
  }

  if (input.pathname.startsWith("/realtor")) {
    return getRealtorPageTitle(input.pathname);
  }

  return getPageTitle(input.pathname);
}
