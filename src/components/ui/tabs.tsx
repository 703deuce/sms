"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({
  items,
}: {
  items: Array<{ label: string; href: string; badge?: string | number }>;
}) {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-border">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge != null ? (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
