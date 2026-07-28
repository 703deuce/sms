"use client";

import { mobilePrimaryNav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <Link
        href="/send"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary-hover lg:hidden"
        aria-label="Compose"
      >
        <Send className="h-5 w-5" />
      </Link>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-header/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1 px-1 py-1.5">
          {mobilePrimaryNav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
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
