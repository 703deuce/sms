import { buildAccountNavItems } from "@/lib/products/account-nav";
import { AI_AFTER_HOURS_DISPLAY_NAME } from "@/lib/products/ai-after-hours";
import {
  BookOpen,
  LayoutDashboard,
  PhoneCall,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type AiAfterHoursNavOptions = {
  primaryVoiceAgentId?: string | null;
};

/**
 * AI After Hours sidebar — canonical six-destination Voice IA (legacy /voice/agents/* redirects).
 */
export function buildAiAfterHoursNav(_options: AiAfterHoursNavOptions = {}): NavItem[] {
  const items: NavItem[] = [
    {
      label: "Overview",
      href: "/voice/overview",
      icon: LayoutDashboard,
      sectionLabel: AI_AFTER_HOURS_DISPLAY_NAME,
      matchExact: true,
    },
    { label: "Receptionist", href: "/voice/receptionist", icon: Sparkles },
    { label: "Calls", href: "/voice/calls", icon: PhoneCall },
    { label: "Knowledge", href: "/voice/knowledge", icon: BookOpen },
    { label: "Call Handling", href: "/voice/call-handling", icon: SlidersHorizontal },
    {
      label: "Numbers",
      href: "/voice/numbers",
      icon: Users,
      sectionLabel: "Manage",
      matchExact: true,
    },
  ];

  items.push(...buildAccountNavItems());
  return items;
}

export function getAiAfterHoursPageTitle(pathname: string): string | null {
  if (pathname === "/voice/overview" || pathname.startsWith("/voice/overview/")) {
    return "Overview";
  }
  if (pathname.startsWith("/voice/receptionist")) return "Receptionist";
  if (pathname.startsWith("/voice/agents")) return "Receptionist";
  if (pathname.startsWith("/voice/calls")) return "Calls";
  if (pathname.startsWith("/voice/knowledge")) return "Knowledge";
  if (pathname.startsWith("/voice/call-handling") || pathname.startsWith("/voice/inbound-routing")) {
    return "Call Handling";
  }
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  return null;
}

export function buildAiAfterHoursMobileNav() {
  return [
    { label: "Overview", href: "/voice/overview" },
    { label: "Receptionist", href: "/voice/receptionist" },
    { label: "Calls", href: "/voice/calls" },
    { label: "Knowledge", href: "/voice/knowledge" },
  ];
}
