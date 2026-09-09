"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const SETTINGS_INDEX: Array<{ title: string; subtitle?: string; href: string; keywords: string[] }> = [
  { title: "Setup checklist", href: "/appointments/setup", keywords: ["setup", "onboarding", "checklist"] },
  { title: "Booking types", href: "/appointments/types", keywords: ["types", "services", "duration", "payment"] },
  { title: "Locations", href: "/appointments/locations", keywords: ["location", "office", "branch", "timezone"] },
  { title: "Staff", href: "/appointments/staff", keywords: ["staff", "provider", "team"] },
  { title: "Availability", href: "/appointments/availability", keywords: ["hours", "schedule", "availability"] },
  { title: "Reminders", href: "/appointments/reminders", keywords: ["reminder", "sms", "confirmation", "24h"] },
  { title: "Booking Pages", href: "/appointments/booking", keywords: ["booking", "page", "public"] },
  { title: "Share & embed", href: "/appointments/booking?section=share", keywords: ["share", "embed", "qr", "link"] },
  { title: "Forms & Documents", href: "/appointments/forms-documents", keywords: ["intake", "form", "contract", "terms"] },
  { title: "Rooms & Equipment", href: "/appointments/rooms-equipment", keywords: ["room", "equipment", "resource"] },
  { title: "Products & Offers", href: "/appointments/products-offers", keywords: ["package", "membership", "gift", "coupon", "discount", "product"] },
  { title: "Packages", href: "/appointments/packages", keywords: ["package", "credits", "sessions"] },
  { title: "Memberships", href: "/appointments/memberships", keywords: ["membership", "subscription"] },
  { title: "Client restrictions", href: "/appointments/client-restrictions", keywords: ["block", "restrict", "ban"] },
  { title: "Integrations", href: "/appointments/integrations", keywords: ["integration", "calendar", "stripe"] },
  { title: "Analytics", href: "/appointments/analytics", keywords: ["analytics", "reports", "metrics"] },
  { title: "POS checkout", href: "/appointments/pos", keywords: ["pos", "cart", "checkout", "retail"] },
];

export function AppointmentsSettingsSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SETTINGS_INDEX.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q) || q.includes(k)),
    ).slice(0, 8);
  }, [query]);

  return (
    <div className={`relative ${className || ""}`}>
      <label htmlFor="appt-settings-search" className="sr-only">Search appointment settings</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="appt-settings-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search settings…"
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
          autoComplete="off"
        />
      </div>
      {open && query.trim() && results.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {results.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={() => {
                  router.push(item.href);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="font-medium">{item.title}</span>
                {item.subtitle ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.subtitle}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
