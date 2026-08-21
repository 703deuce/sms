"use client";

import { buildRealtorMobileNav } from "@/lib/realtor/nav";
import { buildNumbersMobileNav } from "@/lib/products/numbers-nav";
import { mobilePrimaryNav } from "@/lib/nav";
import type { CurrentProduct } from "@/lib/products/types";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Inbox, Megaphone, MoreHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const smsMobileNav = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Contacts", href: "/contacts", icon: Users },
];

export function MobileNav({
  onMore,
  realtorMode = false,
  currentProduct = null,
}: {
  onMore: () => void;
  realtorMode?: boolean;
  currentProduct?: CurrentProduct;
}) {
  const pathname = usePathname();
  const numbersItems = buildNumbersMobileNav().map((item, i) => ({
    ...item,
    icon: mobilePrimaryNav[i]?.icon ?? LayoutDashboard,
  }));

  const items = realtorMode
    ? buildRealtorMobileNav()
    : currentProduct === "numbers"
      ? numbersItems
      : currentProduct === "sms"
        ? smsMobileNav
        : mobilePrimaryNav;

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
