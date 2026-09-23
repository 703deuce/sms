import {
  BarChart3,
  CreditCard,
  Home,
  LayoutDashboard,
  MessageSquare,
  PhoneMissed,
  Plug,
  SlidersHorizontal,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export type MctbNavOptions = {
  inboxBadge?: number;
};

const MCTB_SECTION = "Missed Call Text Back";

/** Canonical MCTB product-local navigation — grouped by product ownership. */
export function buildMctbV1Nav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;

  return [
    {
      label: "Overview",
      href: MCTB_ROUTES.home,
      icon: LayoutDashboard,
      sectionLabel: MCTB_SECTION,
      matchExact: true,
    },
    {
      label: "Missed Calls",
      href: MCTB_ROUTES.missedCalls,
      icon: PhoneMissed,
    },
    {
      label: "Conversations",
      href: MCTB_ROUTES.conversations,
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    {
      label: "Voicemail",
      href: MCTB_ROUTES.voicemail,
      icon: Voicemail,
    },
    {
      label: "Analytics",
      href: MCTB_ROUTES.analytics,
      icon: BarChart3,
    },
    {
      label: "Setup",
      href: MCTB_ROUTES.setup,
      icon: SlidersHorizontal,
    },
    {
      label: "Payments",
      href: MCTB_ROUTES.payments,
      icon: CreditCard,
    },
    {
      label: "Integrations",
      href: MCTB_ROUTES.integrations,
      icon: Plug,
    },
  ];
}

/** Bottom nav for mobile — primary MCTB destinations (compact; full IA via sidebar “More”). */
export function buildMctbV1MobileNav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;
  return [
    { label: "Home", href: MCTB_ROUTES.home, icon: Home },
    { label: "Missed", href: MCTB_ROUTES.missedCalls, icon: PhoneMissed },
    {
      label: "Inbox",
      href: MCTB_ROUTES.conversations,
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    { label: "Setup", href: MCTB_ROUTES.setup, icon: SlidersHorizontal },
  ];
}

export function getMctbPageTitle(pathname: string): string {
  if (pathname === MCTB_ROUTES.home) return "Missed Call Text Back";
  if (pathname === MCTB_ROUTES.missedCalls) return "";
  if (pathname.startsWith(MCTB_ROUTES.missedCalls)) return "Missed Calls";
  if (pathname === MCTB_ROUTES.voicemail) return "";
  if (pathname.startsWith("/mctb/voicemail")) return "Voicemail";
  if (pathname === MCTB_ROUTES.analytics) return "";
  if (pathname.startsWith(MCTB_ROUTES.analytics) || pathname.startsWith("/analytics/mctb")) {
    return "Analytics";
  }
  if (pathname.startsWith(MCTB_ROUTES.voiceAgent)) return "Voice Agent";
  if (pathname.startsWith(MCTB_ROUTES.setup)) return "Setup";
  if (pathname.startsWith(MCTB_ROUTES.numbers)) return "Numbers";
  if (pathname.startsWith(MCTB_ROUTES.complianceConsent)) return "Consent Log";
  if (pathname.startsWith("/onboarding/mctb")) return "Setup";
  if (pathname.startsWith("/conversations") || pathname.startsWith("/mctb/conversations")) {
    return "Conversations";
  }
  if (pathname.startsWith(MCTB_ROUTES.payments)) return "Payments";
  if (pathname === MCTB_ROUTES.integrations || pathname.startsWith("/integrations")) return "Integrations";

  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/voicemail")) return "Voicemail";
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/voice/consent-log")) return "Consent Log";
  if (pathname.startsWith("/voice/try-it")) return "Test";
  if (pathname.startsWith("/voice/schedule")) return "Recovery Controls";

  return "";
}

/** Shared workspace routes that should keep the stored MCTB shell (not Appointments). */
export function isMctbSharedWorkspacePath(pathname: string): boolean {
  if (pathname === "/payments" || pathname.startsWith("/payments/")) return true;
  if (pathname === "/integrations" || pathname.startsWith("/integrations/")) return true;
  return false;
}
