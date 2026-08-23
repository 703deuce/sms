import {
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  PhoneMissed,
  Puzzle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { buildReviewsNav, getReviewsPageTitle, isReviewsSectionPath } from "@/lib/products/reviews-nav";
import { buildSmsSectionNav, getSmsPageTitle } from "@/lib/products/sms-nav";

export type VoiceNavOptions = {
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  inboxBadge?: number;
};

/**
 * Missed Call Text Back — primary product sidebar.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const main: NavItem[] = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
  ];

  if (options.showTryIt) {
    main.push({
      label: "Try It",
      href: "/voice/try-it",
      icon: Sparkles,
    });
  }

  main.push(
    {
      label: "Conversations",
      href: "/voice/conversations",
      icon: MessageSquare,
    },
    {
      label: "Missed Calls",
      href: "/voice/missed-calls",
      icon: PhoneMissed,
    },
    {
      label: "Setup",
      href: "/voice/setup",
      icon: SlidersHorizontal,
    },
  );

  return [
    ...main,
    ...buildSmsSectionNav({ inboxBadge: options.inboxBadge }),
    ...buildReviewsNav(),
    {
      label: "Messaging Compliance",
      href: "/compliance",
      icon: ShieldCheck,
      sectionLabel: "Manage",
    },
    { label: "Analytics", href: "/voice/analytics", icon: BarChart3 },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: "Account",
    },
  ];
}

export function getVoicePageTitle(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/outcomes") return "";
  if (pathname.startsWith("/voice/try-it")) return "Try It";
  if (pathname.startsWith("/voice/conversations")) return "Conversations";
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  if (pathname.startsWith("/compliance")) return "Messaging Compliance";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/contact")) return "Help";
  if (isReviewsSectionPath(pathname)) return getReviewsPageTitle(pathname);
  const smsTitle = getSmsPageTitle(pathname);
  if (smsTitle) return smsTitle;
  return "";
}

export function buildVoiceMobileNav(options: VoiceNavOptions = {}) {
  const items = [{ label: "Home", href: "/dashboard" }];
  if (options.showTryIt) {
    items.push({ label: "Try It", href: "/voice/try-it" });
  }
  items.push(
    { label: "Chats", href: "/voice/conversations" },
    { label: "Missed", href: "/voice/missed-calls" },
    { label: "Setup", href: "/voice/setup" },
  );
  return items;
}
