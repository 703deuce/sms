"use client";

import { buildVoiceMobileNav } from "@/lib/products/voice-nav";
import { cn } from "@/lib/utils";
import { LayoutDashboard, MessageSquare, PhoneMissed, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import type { CurrentProduct } from "@/lib/products/types";

const voiceMobileIcons = [LayoutDashboard, MessageSquare, PhoneMissed, LayoutDashboard];

export function MobileNav({
  onMore,
  currentProduct = null,
  showTryIt = false,
  productFeatures = null,
}: {
  onMore: () => void;
  currentProduct?: CurrentProduct;
  showTryIt?: boolean;
  productFeatures?: WorkspaceFeatureSnapshot | null;
}) {
  const pathname = usePathname();
  const voiceItems = buildVoiceMobileNav({ showTryIt, productFeatures }).map((item, i) => ({
    ...item,
    icon: voiceMobileIcons[i] ?? LayoutDashboard,
  }));

  const items = voiceItems;

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
