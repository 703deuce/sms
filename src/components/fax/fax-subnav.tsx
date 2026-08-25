"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/fax/overview", label: "Overview", exact: true },
  { href: "/fax/inbox", label: "Inbox" },
  { href: "/fax/spam", label: "Spam" },
  { href: "/fax/send", label: "Send Fax" },
  { href: "/fax/sent", label: "Sent" },
  { href: "/fax/numbers", label: "Numbers" },
  { href: "/fax/billing", label: "Billing" },
  { href: "/fax/settings", label: "Settings" },
];

export function FaxSubnav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b pb-3">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
