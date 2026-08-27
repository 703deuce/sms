import type { NavItem } from "@/lib/nav";
import {
  buildSmsPlatformNav,
  getSmsPlatformPageTitle,
  type SmsPlatformNavOptions,
} from "@/lib/products/sms-platform-nav";

export type MassTextNavOptions = SmsPlatformNavOptions;

/** @deprecated Use buildSmsPlatformNav — kept for existing imports. */
export function buildMassTextNav(options: MassTextNavOptions = {}): NavItem[] {
  return buildSmsPlatformNav(options);
}

/** @deprecated Use getSmsPlatformPageTitle */
export const getMassTextPageTitle = getSmsPlatformPageTitle;
