import type { NavItem } from "@/lib/nav";
import { buildAppointmentRemindersMobileNav } from "@/lib/products/appointment-reminders-nav";
import { buildAppointmentsMobileNav, buildAppointmentsV1Nav } from "@/lib/products/appointments-nav";
import { isMctbBundledAiReceptionistPath } from "@/lib/products/mctb-bundled-receptionist-paths";
import { isAppointmentRemindersSharedWorkspacePath } from "@/lib/products/appointment-reminders-nav";
import { buildMctbV1Nav, buildMctbV1MobileNav, isMctbSharedWorkspacePath } from "@/lib/products/mctb-nav";
import { buildAiAfterHoursNav } from "@/lib/products/ai-after-hours-nav";
import { buildSmsPlatformNav } from "@/lib/products/sms-platform-nav";
import { buildMctbShellNav } from "@/lib/products/voice-nav";
import {
  isExplicitAppointmentsShellPath,
  resolveProductShellFromPath,
  type ProductShell,
} from "@/lib/products/product-shell";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import { resolveMctbLaunchProductShell } from "@/lib/mctb/universal-shell";
import { isLaunchProductCustomerVisible } from "@/lib/products/launch-product-availability";
import { isAppointmentsV1Primary, isMctbV1Primary, isSmsOnlyAppNav } from "@/lib/workspace/platform-launch";
import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";
import {
  buildUnifiedAppointmentsMobileNav,
  buildUnifiedAppointmentsNav,
} from "@/lib/products/unified-appointments-nav";
import { buildSchedulingOpusSidebarNav } from "@/lib/products/scheduling-opus-nav";
import { isVoiceProductCustomerVisible } from "@/lib/products/launch-product-availability";
import {
  buildBusinessMessagingMobileNav,
  buildBusinessMessagingNav,
} from "@/lib/products/business-messaging-nav";
import { isBusinessMessagingUnifiedNav } from "@/lib/workspace/platform-launch";

export type ResolveProductNavInput = {
  pathname: string;
  inboxBadge?: number;
  multiProduct: boolean;
  productShell: ProductShell;
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  hasSms?: boolean;
  hasMctb?: boolean;
  hasAppointmentReminders?: boolean;
  hasVoice?: boolean;
  hasNumbers?: boolean;
  smartRoutingFlowId?: string | null;
};

function resolveEffectiveProductShell(
  pathname: string,
  productShell: ProductShell,
  multiProduct: boolean,
  hasMctb = false,
): ProductShell | null {
  const launchShell = resolveMctbLaunchProductShell(pathname, productShell, hasMctb);
  if (launchShell) return launchShell;
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell) return pathShell;
  if (isMctbSharedWorkspacePath(pathname) && productShell === "mctb") return "mctb";
  if (isUnifiedAppointmentsExperience() && isExplicitAppointmentsShellPath(pathname)) {
    return "appointment_reminders";
  }
  if (isAppointmentRemindersSharedWorkspacePath(pathname) && productShell === "appointment_reminders") {
    return "appointment_reminders";
  }
  if (multiProduct) return productShell;
  if (isMctbV1Primary() && hasMctb && isLaunchProductCustomerVisible("mctb")) return "mctb";
  return null;
}

/** Sidebar nav for the active product shell — URL wins over stored shell tab. */
export function resolveProductSidebarNav(input: ResolveProductNavInput): NavItem[] {
  if (isBusinessMessagingUnifiedNav()) {
    return buildBusinessMessagingNav({
      inboxBadge: input.inboxBadge,
      hasMctb: input.hasMctb ?? false,
      hasAppointmentReminders: input.hasAppointmentReminders ?? false,
      hasMassSms: input.hasSms ?? false,
      hasReviews: true,
      hasVisualizer: true,
    });
  }
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );

  if (effectiveShell === "mctb" && isLaunchProductCustomerVisible("mctb")) {
    return buildMctbV1Nav({
      inboxBadge: input.inboxBadge,
      hasVoice: input.hasVoice,
      hasNumbers: input.hasNumbers,
    });
  }
  if (effectiveShell === "appointments") {
    return buildAppointmentsV1Nav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "appointment_reminders" || effectiveShell === "appointments") {
    return buildSchedulingOpusSidebarNav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "mass_sms") {
    return buildSmsPlatformNav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "ai_after_hours") {
    if (!isVoiceProductCustomerVisible()) {
      return buildMctbV1Nav({
        inboxBadge: input.inboxBadge,
        hasVoice: false,
        hasNumbers: input.hasNumbers,
      });
    }
    return buildAiAfterHoursNav({
      primaryVoiceAgentId: input.primaryVoiceAgentId ?? null,
    });
  }

  if (isMctbV1Primary() && input.hasMctb && isLaunchProductCustomerVisible("mctb")) {
    return buildMctbV1Nav({
      inboxBadge: input.inboxBadge,
      hasVoice: input.hasVoice,
      hasNumbers: input.hasNumbers,
    });
  }

  if (isAppointmentsV1Primary()) {
    return buildAppointmentsV1Nav({ conversationsBadge: input.inboxBadge });
  }

  if (isSmsOnlyAppNav()) {
    return buildSmsPlatformNav({ conversationsBadge: input.inboxBadge });
  }

  const shellNav = {
    primaryVoiceAgentId: input.primaryVoiceAgentId ?? null,
    showTryIt: input.showTryIt,
    smartRoutingFlowId: input.smartRoutingFlowId ?? null,
    productFeatures: input.productFeatures,
    showBillingNav: true,
    inboxBadge: input.inboxBadge,
    hasSms: input.hasSms,
  };

  if (input.multiProduct) {
    return buildMctbShellNav(shellNav);
  }

  return buildMctbShellNav(shellNav);
}

export function resolveProductMobileNav(input: ResolveProductNavInput): NavItem[] {
  if (isBusinessMessagingUnifiedNav()) {
    return buildBusinessMessagingMobileNav({
      inboxBadge: input.inboxBadge,
      hasMctb: input.hasMctb ?? false,
      hasAppointmentReminders: input.hasAppointmentReminders ?? false,
      hasMassSms: input.hasSms ?? false,
    });
  }
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );

  if (effectiveShell === "mctb" && isLaunchProductCustomerVisible("mctb")) {
    return buildMctbV1MobileNav({
      inboxBadge: input.inboxBadge,
      hasVoice: input.hasVoice,
    });
  }
  if (effectiveShell === "appointments") {
    return buildAppointmentsMobileNav();
  }
  if (effectiveShell === "appointment_reminders") {
    if (isUnifiedAppointmentsExperience()) {
      return buildUnifiedAppointmentsMobileNav({ conversationsBadge: input.inboxBadge });
    }
    return buildAppointmentRemindersMobileNav();
  }
  if (effectiveShell === "mass_sms") {
    return buildSmsPlatformNav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "ai_after_hours") {
    if (!isVoiceProductCustomerVisible()) {
      return buildMctbV1MobileNav({
        inboxBadge: input.inboxBadge,
        hasVoice: false,
      });
    }
    return buildAiAfterHoursNav({
      primaryVoiceAgentId: input.primaryVoiceAgentId ?? null,
    });
  }
  if (isAppointmentsV1Primary()) {
    return buildAppointmentsMobileNav();
  }
  return buildMctbV1MobileNav({
    inboxBadge: input.inboxBadge,
    hasVoice: input.hasVoice,
  });
}

export function isMctbShellActive(
  pathname: string,
  multiProduct: boolean,
  productShell: ProductShell,
  hasMctb = false,
): boolean {
  if (isMctbV1Primary() && hasMctb && isMctbBundledAiReceptionistPath(pathname)) {
    return true;
  }
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell === "mctb") return true;
  if (
    pathShell === "appointments" ||
    pathShell === "appointment_reminders" ||
    pathShell === "mass_sms" ||
    pathShell === "ai_after_hours"
  ) {
    return false;
  }
  if (isMctbSharedWorkspacePath(pathname) && productShell === "mctb") return true;
  if (isMctbV1Primary() && hasMctb) return true;
  return multiProduct && productShell === "mctb";
}

export function isAppointmentsShellActive(
  pathname: string,
  multiProduct: boolean,
  productShell: ProductShell,
  hasMctb = false,
): boolean {
  if (isMctbV1Primary() && hasMctb) return false;
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell === "appointments") return true;
  if (
    isUnifiedAppointmentsExperience() &&
    pathShell === "appointment_reminders" &&
    isExplicitAppointmentsShellPath(pathname)
  ) {
    return true;
  }
  if (pathShell === "mctb") return false;
  return multiProduct ? productShell === "appointments" : isAppointmentsV1Primary();
}
