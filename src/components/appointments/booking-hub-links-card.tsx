"use client";

import Link from "next/link";

export function BookingHubLinksCard() {
  const links = [
    {
      href: "/appointments/booking/share",
      title: "Share & embed",
      description: "Copy links, QR codes, and embed codes for your booking page.",
    },
    {
      href: "/appointments/booking/branding",
      title: "Branding & appearance",
      description: "Colors, logo, terminology, and advanced booking page styling.",
    },
    {
      href: "/appointments/booking/forms",
      title: "Forms & documents",
      description: "Intake forms, contracts, and terms assigned to booking types.",
    },
    {
      href: "/appointments/booking/share",
      title: "Share & embed",
      description: "Direct links, QR codes, embed codes, and single-use links.",
    },
    {
      href: "/payments/invoices",
      title: "Invoices",
      description: "Bill customers and send payment links.",
    },
  ];

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3" aria-labelledby="booking-hub-links">
      <h2 id="booking-hub-links" className="text-sm font-semibold text-foreground">
        Related booking tools
      </h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-lg border border-transparent px-3 py-2 hover:border-border hover:bg-muted/40 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{link.title}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{link.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
