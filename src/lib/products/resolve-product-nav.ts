import type { NavItem } from "@/lib/nav";
import type { ResolveProductNavInput } from "@/lib/products/resolve-product-nav-types";
import {
  buildMctbPrimaryMobileNav,
  buildMctbPrimarySidebarNav,
  shouldUseMctbPrimaryMobile,
  shouldUseMctbPrimarySidebar,
} from "@/lib/products/resolve-mctb-primary-nav";

export type { ResolveProductNavInput } from "@/lib/products/resolve-product-nav-types";
export { isAppointmentsShellActive, isMctbShellActive } from "@/lib/products/resolve-product-nav-shell";

/** @deprecated Prefer shouldUseMctbPrimarySidebar + buildMctbPrimarySidebarNav in shell UI. */
export function resolveProductSidebarNav(input: ResolveProductNavInput): NavItem[] {
  if (shouldUseMctbPrimarySidebar(input)) {
    return buildMctbPrimarySidebarNav(input);
  }
  throw new Error("resolveProductSidebarNav: use resolve-product-nav-extended for non-MCTB shells");
}

export function resolveProductMobileNav(input: ResolveProductNavInput): NavItem[] {
  if (shouldUseMctbPrimaryMobile(input)) {
    return buildMctbPrimaryMobileNav(input);
  }
  throw new Error("resolveProductMobileNav: use resolve-product-nav-extended for non-MCTB shells");
}
