"use client";

import { buildRealtorMobileNav } from "@/lib/realtor/nav";
import { buildAppointmentsMobileNav } from "@/lib/products/appointments-nav";
import { buildNumbersMobileNav } from "@/lib/products/numbers-nav";
import { buildAiAfterHoursMobileNav } from "@/lib/products/ai-after-hours-nav";
import { buildMassSmsMobileNav, buildVoiceMobileNav } from "@/lib/products/voice-nav";
import { useProductShell } from "@/components/products/product-shell-tabs";
import { shouldShowProductSwitcher } from "@/lib/products/product-shell";
import { isSmsOnlyAppNav, isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";
import { cn } from "@/lib/utils";
import {
  AudioLines,
  BookOpen,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PhoneCall,
  PhoneMissed,
  Users,
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

  const appointmentsItems = buildAppointmentsMobileNav().map((item, i) => ({
    ...item,
    icon: [LayoutDashboard, Calendar, ClipboardList, MessageSquare, Users][i] ?? LayoutDashboard,
  }));

  const items = realtorMode
    ? buildRealtorMobileNav()
    : isAppointmentsV1Primary()
      ? appointmentsItems
      : currentProduct === "numbers"
      ? numbersItems
      : isSmsOnlyAppNav()
        ? massSmsItems
        : multiProduct
        ? productShell === "mass_sms"
          ? massSmsItems
          : productShell === "ai_after_hours"
            ? aiAfterHoursItems
            : voiceItems
        : hasMassSms
          ? massSmsItems
          : hasAiAfterHours
            ? aiAfterHoursItems
            : voiceItems;

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
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
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
