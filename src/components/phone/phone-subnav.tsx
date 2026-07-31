"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { label: "Softphone", href: "/phone" },
  { label: "Call history", href: "/phone/calls" },
  { label: "Queues", href: "/phone/queues" },
  { label: "IVR menus", href: "/phone/ivr" },
  { label: "Settings", href: "/phone/settings" },
];

export function PhoneSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-sm">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
