import type { NavItem } from "@/lib/nav";
import { buildAppointmentsMobileNav, buildAppointmentsV1Nav } from "@/lib/products/appointments-nav";
import { isMctbBundledAiReceptionistPath } from "@/lib/products/mctb-bundled-receptionist-paths";
import { buildMctbV1Nav, buildMctbV1MobileNav, isMctbSharedWorkspacePath } from "@/lib/products/mctb-nav";
import {
  buildAiAfterHoursMobileNav,
  buildAiAfterHoursNav,
} from "@/lib/products/ai-after-hours-nav";
import { buildSmsPlatformNav } from "@/lib/products/sms-platform-nav";
import { buildMctbShellNav } from "@/lib/products/voice-nav";
import {
  resolveProductShellFromPath,
  type ProductShell,
} from "@/lib/products/product-shell";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import { resolveMctbLaunchProductShell } from "@/lib/mctb/universal-shell";
import { isAppointmentsV1Primary, isMctbV1Primary, isSmsOnlyAppNav } from "@/lib/workspace/platform-launch";

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
  if (multiProduct) return productShell;
  if (isMctbV1Primary() && hasMctb) return "mctb";
  return null;
}

/** Sidebar nav for the active product shell — URL wins over stored shell tab. */
export function resolveProductSidebarNav(input: ResolveProductNavInput): NavItem[] {
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );

  if (effectiveShell === "mctb") {
    return buildMctbV1Nav({
      inboxBadge: input.inboxBadge,
      hasVoice: input.hasVoice,
      hasNumbers: input.hasNumbers,
    });
  }
  if (effectiveShell === "appointments") {
    return buildAppointmentsV1Nav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "mass_sms") {
    return buildSmsPlatformNav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "ai_after_hours") {
    return buildAiAfterHoursNav({
      primaryVoiceAgentId: input.primaryVoiceAgentId ?? null,
    });
  }

  if (isMctbV1Primary() && input.hasMctb) {
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
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );

  if (effectiveShell === "mctb") {
    return buildMctbV1MobileNav({
      inboxBadge: input.inboxBadge,
      hasVoice: input.hasVoice,
    });
  }
  if (effectiveShell === "appointments") {
    return buildAppointmentsMobileNav();
  }
  if (effectiveShell === "mass_sms") {
    return buildSmsPlatformNav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "ai_after_hours") {
    return buildAiAfterHoursMobileNav();
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
  if (pathShell === "appointments" || pathShell === "mass_sms" || pathShell === "ai_after_hours") {
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
  if (pathShell === "mctb") return false;
  return multiProduct ? productShell === "appointments" : isAppointmentsV1Primary();
}
