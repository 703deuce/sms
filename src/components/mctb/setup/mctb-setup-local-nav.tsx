"use client";

import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import "../kimi-ui/reference.css";

const SETUP_LINKS = [
  { href: MCTB_ROUTES.setup, label: "Overview", exact: true },
  { href: MCTB_ROUTES.setupPhone, label: "Phone & Forwarding" },
  { href: MCTB_ROUTES.setupMissedCallRules, label: "Missed-call rules" },
  { href: MCTB_ROUTES.setupTextBack, label: "Text Back" },
  { href: MCTB_ROUTES.setupLinks, label: "Links & request form" },
  { href: MCTB_ROUTES.setupConsent, label: "Consent" },
  { href: MCTB_ROUTES.setupNotifications, label: "Notifications & Handoff" },
  { href: MCTB_ROUTES.setupRecovery, label: "Recovery controls" },
  { href: MCTB_ROUTES.setupVoicemail, label: "Voicemail" },
  { href: MCTB_ROUTES.setupExclusions, label: "Exclusions" },
  { href: MCTB_ROUTES.setupTest, label: "Test & diagnostics" },
] as const;

export function MctbSetupLocalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Setup sections" className="ref-deco-setup-nav p-2">
      <ul className="space-y-0.5">
        {SETUP_LINKS.map((link) => {
          const exact = "exact" in link && link.exact;
          const active = exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "ref-deco-setup-nav-link",
                  active && "ref-deco-setup-nav-link--active",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
