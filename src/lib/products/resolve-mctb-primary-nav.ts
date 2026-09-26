import { buildMctbV1Nav, buildMctbV1MobileNav } from "@/lib/products/mctb-nav";
import type { ResolveProductNavInput } from "@/lib/products/resolve-product-nav-types";
import { resolveEffectiveProductShell } from "@/lib/products/resolve-product-nav-shell";
import { isAppointmentsV1Primary, isMctbV1Primary, isSmsOnlyAppNav } from "@/lib/workspace/platform-launch";

export function shouldUseMctbPrimarySidebar(input: ResolveProductNavInput): boolean {
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );
  if (effectiveShell === "mctb") return true;
  if (isMctbV1Primary() && input.hasMctb) return true;
  return false;
}

export function shouldUseMctbPrimaryMobile(input: ResolveProductNavInput): boolean {
  const effectiveShell = resolveEffectiveProductShell(
    input.pathname,
    input.productShell,
    input.multiProduct,
    input.hasMctb,
  );
  if (effectiveShell === "mctb") return true;
  if (
    effectiveShell === "appointments" ||
    effectiveShell === "mass_sms" ||
    effectiveShell === "ai_after_hours"
  ) {
    return false;
  }
  if (isAppointmentsV1Primary()) return false;
  if (isSmsOnlyAppNav()) return false;
  return true;
}

export function buildMctbPrimarySidebarNav(input: ResolveProductNavInput) {
  return buildMctbV1Nav({
    inboxBadge: input.inboxBadge,
    hasVoice: input.hasVoice,
    hasNumbers: input.hasNumbers,
  });
}

export function buildMctbPrimaryMobileNav(input: ResolveProductNavInput) {
  return buildMctbV1MobileNav({
    inboxBadge: input.inboxBadge,
    hasVoice: input.hasVoice,
  });
}
