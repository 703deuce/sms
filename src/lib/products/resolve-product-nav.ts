import type { NavItem } from "@/lib/nav";
import { buildAppointmentsMobileNav, buildAppointmentsV1Nav } from "@/lib/products/appointments-nav";
import { buildMctbV1Nav, buildMctbV1MobileNav } from "@/lib/products/mctb-nav";
import { buildAiAfterHoursNav } from "@/lib/products/ai-after-hours-nav";
import { buildSmsPlatformNav } from "@/lib/products/sms-platform-nav";
import { buildMctbShellNav } from "@/lib/products/voice-nav";
import {
  resolveProductShellFromPath,
  type ProductShell,
} from "@/lib/products/product-shell";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import { isAppointmentsV1Primary, isSmsOnlyAppNav } from "@/lib/workspace/platform-launch";

export type ResolveProductNavInput = {
  pathname: string;
  inboxBadge?: number;
  multiProduct: boolean;
  productShell: ProductShell;
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  hasSms?: boolean;
  smartRoutingFlowId?: string | null;
};

/** Sidebar nav for the active product shell — URL wins over stored shell tab. */
export function resolveProductSidebarNav(input: ResolveProductNavInput): NavItem[] {
  const pathShell = resolveProductShellFromPath(input.pathname);
  const effectiveShell: ProductShell | null =
    pathShell ?? (input.multiProduct ? input.productShell : null);

  if (effectiveShell === "mctb") {
    return buildMctbV1Nav({ inboxBadge: input.inboxBadge });
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
  const pathShell = resolveProductShellFromPath(input.pathname);
  const effectiveShell: ProductShell | null =
    pathShell ?? (input.multiProduct ? input.productShell : null);

  if (effectiveShell === "mctb") {
    return buildMctbV1MobileNav({ inboxBadge: input.inboxBadge });
  }
  if (effectiveShell === "appointments") {
    return buildAppointmentsMobileNav();
  }
  if (effectiveShell === "mass_sms") {
    return buildSmsPlatformNav({ conversationsBadge: input.inboxBadge });
  }
  if (effectiveShell === "ai_after_hours") {
    return buildAiAfterHoursNav({
      primaryVoiceAgentId: input.primaryVoiceAgentId ?? null,
    });
  }
  if (isAppointmentsV1Primary()) {
    return buildAppointmentsMobileNav();
  }
  return buildMctbV1MobileNav({ inboxBadge: input.inboxBadge });
}

export function isMctbShellActive(pathname: string, multiProduct: boolean, productShell: ProductShell): boolean {
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell === "mctb") return true;
  return multiProduct && productShell === "mctb";
}

export function isAppointmentsShellActive(
  pathname: string,
  multiProduct: boolean,
  productShell: ProductShell,
): boolean {
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell === "appointments") return true;
  if (pathShell === "mctb") return false;
  return multiProduct ? productShell === "appointments" : isAppointmentsV1Primary();
}
