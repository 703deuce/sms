import {
  BarChart3,
  Hash,
  LayoutDashboard,
  MessageSquare,
  PhoneMissed,
  Puzzle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type VoiceNavOptions = {
  primaryVoiceAgentId?: string | null;
};

/**
 * Missed Call Text Back — primary product sidebar.
 */
export function buildVoiceNav(_options: VoiceNavOptions = {}): NavItem[] {
  return [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
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
    {
      label: "Numbers",
      href: "/voice/numbers",
      icon: Hash,
      sectionLabel: "Manage",
    },
    {
      label: "Compliance",
      href: "/compliance",
      icon: ShieldCheck,
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
  if (pathname.startsWith("/voice/conversations")) return "Conversations";
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  if (pathname.startsWith("/compliance")) return "Messaging Compliance";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildVoiceMobileNav() {
  return [
    { label: "Home", href: "/dashboard" },
    { label: "Chats", href: "/voice/conversations" },
    { label: "Missed", href: "/voice/missed-calls" },
    { label: "Setup", href: "/voice/setup" },
  ];
}
