"use client";

import { buildRealtorMobileNav } from "@/lib/realtor/nav";
import { resolveProductMobileNav } from "@/lib/products/resolve-product-nav";
import { isAppointmentsNavItemActive } from "@/lib/products/appointments-routes";
import { buildNumbersMobileNav } from "@/lib/products/numbers-nav";
import { buildAiAfterHoursMobileNav } from "@/lib/products/ai-after-hours-nav";
import { buildMassSmsMobileNav, buildVoiceMobileNav } from "@/lib/products/voice-nav";
import { useProductShell } from "@/components/products/product-shell-tabs";
import { resolveProductShellFromPath, shouldShowProductSwitcher } from "@/lib/products/product-shell";
import { isMctbShellActive } from "@/lib/products/resolve-product-nav";
import { isMctbProductChromePath } from "@/lib/products/mctb-shell";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { isSmsOnlyAppNav, isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";
import { cn } from "@/lib/utils";
import {
  AudioLines,
  BookOpen,
  Calendar,
  Globe,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PhoneCall,
  PhoneMissed,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import type { CurrentProduct } from "@/lib/products/types";

const voiceMobileIcons = [PhoneMissed, PhoneCall, AudioLines, BookOpen];
const massSmsMobileIcons = [LayoutDashboard, Megaphone, MessageSquare, Users];
const aiAfterHoursMobileIcons = [LayoutDashboard, Moon, PhoneCall, BookOpen];

export function MobileNav({
  onMore,
  realtorMode = false,
  currentProduct = null,
  showTryIt = false,
  productFeatures = null,
  hasMctb = false,
  hasMassSms = false,
  hasAiAfterHours = false,
  primaryVoiceAgentId = null,
}: {
  onMore: () => void;
  realtorMode?: boolean;
  currentProduct?: CurrentProduct;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  hasMctb?: boolean;
  hasMassSms?: boolean;
  hasAiAfterHours?: boolean;
  primaryVoiceAgentId?: string | null;
}) {
  const pathname = usePathname();
  const multiProduct = shouldShowProductSwitcher({
    hasMctb,
    hasMassSms,
    hasAiAfterHours,
  });
  const { shell: productShell } = useProductShell(hasMctb, hasMassSms, hasAiAfterHours);
  const mctbNeutral = isMctbProductChromePath(pathname, productShell);

  const voiceItems = buildVoiceMobileNav({ showTryIt, productFeatures }).map((item, i) => ({
    ...item,
    icon: voiceMobileIcons[i] ?? LayoutDashboard,
  }));
  const massSmsItems = buildMassSmsMobileNav().map((item, i) => ({
    ...item,
    icon: massSmsMobileIcons[i] ?? LayoutDashboard,
  }));
  const aiAfterHoursItems = buildAiAfterHoursMobileNav(primaryVoiceAgentId).map((item, i) => ({
    ...item,
    icon: aiAfterHoursMobileIcons[i] ?? LayoutDashboard,
  }));
  const numbersItems = buildNumbersMobileNav().map((item, i) => ({
    ...item,
    icon: voiceMobileIcons[i] ?? LayoutDashboard,
  }));

  const resolvedMobile = resolveProductMobileNav({
    pathname,
    inboxBadge: 0,
    multiProduct,
    productShell,
    primaryVoiceAgentId,
    showTryIt,
    productFeatures,
    hasSms: hasMassSms,
  });

  const mobileIconSets: Record<string, typeof Home[]> = {
    Home: [Home, Calendar, Globe, MessageSquare, Users],
    mctb: [Home, PhoneMissed, MessageSquare, SlidersHorizontal],
  };

  const items = realtorMode
    ? buildRealtorMobileNav()
    : currentProduct === "numbers"
      ? numbersItems
      : resolvedMobile.map((item, i) => {
          const icons =
            item.href.startsWith("/mctb")
              ? mobileIconSets.mctb
              : mobileIconSets.Home;
          return { ...item, icon: icons[i] ?? Home };
        });

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-header/95 backdrop-blur lg:hidden">
        <div
          className={cn(
            "grid gap-1 px-1 py-1.5",
            items.length >= 4 ? "grid-cols-5" : "grid-cols-3",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const mctbShell = isMctbShellActive(pathname, multiProduct, productShell);
            const active = mctbShell
              ? item.href === MCTB_ROUTES.home
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
              : isAppointmentsNavItemActive(item.href, pathname);
            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-medium",
                  active
                    ? mctbNeutral
                      ? "mctb-mobile-tab-active text-[#1b1e23]"
                      : "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={onMore}
            className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
