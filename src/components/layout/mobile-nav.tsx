"use client";

import { buildRealtorMobileNav } from "@/lib/realtor/nav";
import { buildNumbersMobileNav } from "@/lib/products/numbers-nav";
import { buildMassSmsMobileNav, buildVoiceMobileNav } from "@/lib/products/voice-nav";
import { cn } from "@/lib/utils";
import {
  AudioLines,
  BookOpen,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
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

export function MobileNav({
  onMore,
  realtorMode = false,
  currentProduct = null,
  showTryIt = false,
  productFeatures = null,
  hasMctb = false,
  hasMassSms = false,
}: {
  onMore: () => void;
  realtorMode?: boolean;
  currentProduct?: CurrentProduct;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  hasMctb?: boolean;
  hasMassSms?: boolean;
}) {
  const pathname = usePathname();

  const voiceItems = buildVoiceMobileNav({ showTryIt, productFeatures }).map((item, i) => ({
    ...item,
    icon: voiceMobileIcons[i] ?? LayoutDashboard,
  }));
  const massSmsItems = buildMassSmsMobileNav().map((item, i) => ({
    ...item,
    icon: massSmsMobileIcons[i] ?? LayoutDashboard,
  }));
  const numbersItems = buildNumbersMobileNav().map((item, i) => ({
    ...item,
    icon: voiceMobileIcons[i] ?? LayoutDashboard,
  }));

  const items = realtorMode
    ? buildRealtorMobileNav()
    : currentProduct === "numbers"
      ? numbersItems
      : hasMassSms
        ? massSmsItems
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
