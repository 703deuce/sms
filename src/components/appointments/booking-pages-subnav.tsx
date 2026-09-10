"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/appointments/booking", label: "Pages", section: null },
  { href: "/appointments/booking?section=share", label: "Share & embed", section: "share" },
  { href: "/appointments/booking?section=branding", label: "Branding", section: "branding" },
  { href: "/appointments/booking/forms", label: "Forms & documents", section: null },
  { href: "/appointments/booking/rooms-equipment", label: "Rooms & equipment", section: null },
] as const;

export function BookingPagesSubnav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSection = searchParams.get("section");

  return (
    <nav
      className="flex flex-wrap gap-1 pb-0"
      aria-label="Booking pages sections"
    >
      {LINKS.map((link) => {
        const linkPath = link.href.split("?")[0];
        const active =
          link.section === null
            ? pathname === linkPath && !currentSection
            : pathname === "/appointments/booking" && currentSection === link.section;
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
