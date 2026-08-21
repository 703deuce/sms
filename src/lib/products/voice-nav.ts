import {
  AudioLines,
  BarChart3,
  BookOpen,
  Hash,
  HelpCircle,
  LayoutDashboard,
  PhoneCall,
  Puzzle,
  Settings,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { buildReceptionistNavChildren } from "@/lib/solutions-nav";

export type VoiceNavOptions = {
  primaryVoiceAgentId?: string | null;
};

/**
 * AI Receptionist — primary launch sidebar.
 * Sub-pages live under Receptionist, Calls, Knowledge, etc.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const agentId =
    options.primaryVoiceAgentId != null && options.primaryVoiceAgentId !== ""
      ? options.primaryVoiceAgentId
      : null;
  const receptionistHref = agentId
    ? `/voice/agents/${agentId}/about`
    : "/voice/receptionist";

  return [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
    { label: "Calls", href: "/voice/calls", icon: PhoneCall, emphasize: true },
    {
      label: "Receptionist",
      href: receptionistHref,
      icon: AudioLines,
      children: buildReceptionistNavChildren(agentId),
    },
    { label: "Knowledge", href: "/voice/knowledge", icon: BookOpen },
    {
      label: "Numbers",
      href: "/voice/numbers",
      icon: Hash,
      sectionLabel: "Manage",
    },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    { label: "Analytics", href: "/voice/analytics", icon: BarChart3 },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: "Account",
    },
    { label: "Help", href: "/contact", icon: HelpCircle },
  ];
}

export function getVoicePageTitle(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/outcomes") return "";
  if (pathname.startsWith("/voice/calls")) return "Calls";
  if (pathname.startsWith("/voice/receptionist")) return "Receptionist";
  if (pathname.startsWith("/voice/agents")) return "Receptionist";
  if (pathname.startsWith("/voice/knowledge")) return "Knowledge";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  if (pathname.startsWith("/voice/settings")) return "Settings";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildVoiceMobileNav() {
  return [
    { label: "Home", href: "/dashboard" },
    { label: "Calls", href: "/voice/calls" },
    { label: "Receptionist", href: "/voice/receptionist" },
    { label: "Knowledge", href: "/voice/knowledge" },
  ];
}
