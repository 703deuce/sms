/**
 * Non-MCTB-primary sidebar/mobile nav builders.
 * Loaded on demand so first /mctb compile does not pull appointments/SMS/legacy voice nav graphs.
 */
import type { NavItem } from "@/lib/nav";
import { buildAppointmentsMobileNav, buildAppointmentsV1Nav } from "@/lib/products/appointments-nav";
import { buildAiAfterHoursNav } from "@/lib/products/ai-after-hours-nav";
import { buildSmsPlatformNav } from "@/lib/products/sms-platform-nav";
import { buildMctbShellNav } from "@/lib/products/voice-nav";
import type { ResolveProductNavInput } from "@/lib/products/resolve-product-nav-types";
import { resolveEffectiveProductShell } from "@/lib/products/resolve-product-nav-shell";
import { isAppointmentsV1Primary, isSmsOnlyAppNav } from "@/lib/workspace/platform-launch";
import { buildMctbV1MobileNav } from "@/lib/products/mctb-nav";

export function resolveProductSidebarNavExtended(input: ResolveProductNavInput): NavItem[] {
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );

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

  return buildMctbShellNav(shellNav);
}

export function resolveProductMobileNavExtended(input: ResolveProductNavInput): NavItem[] {
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );

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
  return buildMctbV1MobileNav({
    inboxBadge: input.inboxBadge,
    hasVoice: input.hasVoice,
  });
}
