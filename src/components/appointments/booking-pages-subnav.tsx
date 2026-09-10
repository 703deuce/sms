"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/appointments/booking", label: "Pages" },
  { href: "/appointments/booking/share", label: "Share & embed" },
  { href: "/appointments/booking/branding", label: "Branding" },
  { href: "/appointments/booking/forms", label: "Forms & documents" },
  { href: "/appointments/booking/rooms-equipment", label: "Rooms & equipment" },
] as const;

export function BookingPagesSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 pb-0"
      aria-label="Booking pages sections"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/appointments/booking"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-[#5b4bff]/10 text-[#5b4bff]"
                : "text-[#6b7280] hover:bg-[#f7f8fb] hover:text-[#1a1d29]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
