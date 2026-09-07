import {
  BarChart3,
  Home,
  MessageSquare,
  PhoneMissed,
  Settings,
  SlidersHorizontal,
  Users,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type MctbNavOptions = {
  inboxBadge?: number;
};

/**
 * Canonical MCTB product-local navigation for the V1 Appointments + MCTB shell.
 * Routes use legacy /voice/* paths until /mctb/* page rebuild ships.
 */
export function buildMctbV1Nav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;

  return [
    {
      label: "Home",
      href: "/voice/missed-calls",
      icon: Home,
      matchExact: true,
    },
    {
      label: "Missed Calls",
      href: "/voice/missed-calls",
      icon: PhoneMissed,
    },
    {
      label: "Conversations",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    {
      label: "Voicemail",
      href: "/voice/voicemail",
      icon: Voicemail,
    },
    {
      label: "Analytics",
      href: "/voice/analytics",
      icon: BarChart3,
    },
    {
      label: "Setup",
      href: "/voice/setup",
      icon: SlidersHorizontal,
      sectionLabel: "Configure",
    },
    {
      label: "Numbers",
      href: "/voice/numbers",
      icon: Users,
    },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
    },
  ];
}

/** Bottom nav for mobile — primary MCTB destinations. */
export function buildMctbV1MobileNav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;
  return [
    { label: "Home", href: "/voice/missed-calls", icon: Home },
    { label: "Missed", href: "/voice/missed-calls", icon: PhoneMissed },
    {
      label: "Inbox",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    { label: "Setup", href: "/voice/setup", icon: SlidersHorizontal },
  ];
}

export function getMctbPageTitle(pathname: string): string {
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/voicemail")) return "Voicemail";
  if (pathname.startsWith("/voice/analytics") || pathname.startsWith("/analytics/mctb")) {
    return "Analytics";
  }
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/voice/consent-log")) return "Consent Log";
  if (pathname.startsWith("/voice/try-it")) return "Test";
  if (pathname.startsWith("/voice/schedule")) return "Recovery Controls";
  if (pathname.startsWith("/onboarding/mctb")) return "Setup";
  if (pathname.startsWith("/conversations")) return "Conversations";
  return "";
}
