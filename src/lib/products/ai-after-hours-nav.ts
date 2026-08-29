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
 * AI After Hours sidebar — reuses existing /voice/* agent and call surfaces.
 */
export function buildAiAfterHoursNav(options: AiAfterHoursNavOptions = {}): NavItem[] {
  const agentId = options.primaryVoiceAgentId ?? null;
  const agentRoot = agentId ? `/voice/agents/${agentId}/about` : "/voice/agents";

  const items: NavItem[] = [
    {
      label: "Overview",
      href: "/voice/overview",
      icon: LayoutDashboard,
      sectionLabel: AI_AFTER_HOURS_DISPLAY_NAME,
      matchExact: true,
    },
    {
      label: "AI Agent",
      href: agentRoot,
      icon: Sparkles,
      children: agentId
        ? [
            { label: "About", href: `/voice/agents/${agentId}/about` },
            { label: "Capabilities", href: `/voice/agents/${agentId}/capabilities` },
            { label: "Integrations", href: `/voice/agents/${agentId}/integrations` },
            { label: "Advanced", href: `/voice/agents/${agentId}/advanced` },
            { label: "Voice & Test", href: `/voice/agents/${agentId}/voice-test` },
          ]
        : [
            { label: "All agents", href: "/voice/agents" },
            { label: "Create agent", href: "/voice/agents/new" },
          ],
    },
    { label: "Calls", href: "/voice/calls", icon: PhoneCall },
    { label: "Knowledge", href: "/voice/knowledge", icon: BookOpen },
    { label: "Call Handling", href: "/voice/inbound-routing", icon: SlidersHorizontal },
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
  if (pathname.startsWith("/voice/agents")) {
    if (pathname.endsWith("/about")) return "AI Agent";
    if (pathname.endsWith("/capabilities")) return "Capabilities";
    if (pathname.endsWith("/integrations")) return "Integrations";
    if (pathname.endsWith("/advanced")) return "Advanced";
    if (pathname.endsWith("/voice-test")) return "Voice & Test";
    if (pathname === "/voice/agents/new") return "Create AI Agent";
    if (pathname === "/voice/agents") return "AI Agent";
    return "AI Agent";
  }
  if (pathname.startsWith("/voice/calls")) return "Calls";
  if (pathname.startsWith("/voice/knowledge")) return "Knowledge";
  if (pathname.startsWith("/voice/inbound-routing")) return "Call Handling";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  return null;
}

export function buildAiAfterHoursMobileNav(agentId?: string | null) {
  const agentHref = agentId ? `/voice/agents/${agentId}/about` : "/voice/agents";
  return [
    { label: "Overview", href: "/voice/overview" },
    { label: "Agent", href: agentHref },
    { label: "Calls", href: "/voice/calls" },
    { label: "Knowledge", href: "/voice/knowledge" },
  ];
}
