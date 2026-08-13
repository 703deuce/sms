import {
  AudioLines,
  Building2,
  Hash,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Puzzle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavChild, NavItem } from "@/lib/nav";

export type SolutionNavInstance = {
  id: string;
  label: string;
  status: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
};

export type SolutionsNavOptions = {
  /** Kept for shell compatibility. */
  instancesBySolution?: Record<string, SolutionNavInstance[]>;
  primaryVoiceAgentId?: string | null;
};

/** Flat product sidebar — matches setup mockups (no per-page submenu). */
export function buildProductNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/outcomes", icon: LayoutDashboard },
    { label: "My Receptionist", href: "/voice/agents", icon: AudioLines },
    { label: "Phone Numbers", href: "/numbers", icon: Hash },
    { label: "Settings", href: "/settings/business", icon: Settings },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Organizations", href: "/contacts/lists", icon: Building2 },
    { label: "Credentials", href: "/integrations/crm", icon: KeyRound },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    { label: "Affiliates", href: "/settings/billing", icon: Megaphone },
  ];
}

export function buildReceptionistNavChildren(agentId?: string | null): NavChild[] {
  const listOnly = "/voice/agents";
  if (!agentId) {
    return [
      { label: "Agents", href: listOnly },
      { label: "About Your Receptionist", href: "/voice/agents/new" },
      { label: "What It Should Do", href: listOnly },
      { label: "Connect integrations", href: listOnly },
      { label: "Advanced", href: listOnly },
      { label: "Voice & Test", href: listOnly },
    ];
  }
  return [
    { label: "Agents", href: listOnly },
    { label: "About Your Receptionist", href: `/voice/agents/${agentId}/about` },
    { label: "What It Should Do", href: `/voice/agents/${agentId}/capabilities` },
    { label: "Connect integrations", href: `/voice/agents/${agentId}/integrations` },
    { label: "Advanced", href: `/voice/agents/${agentId}/advanced` },
    { label: "Voice & Test", href: `/voice/agents/${agentId}/voice-test` },
  ];
}

/** Launch sidebar — flat mockup nav globally. */
export function buildSolutionsNav(_options: SolutionsNavOptions = {}): NavItem[] {
  return buildProductNav();
}

/** Static launch nav — used for titles / tests. */
export const solutionsNav: NavItem[] = buildProductNav();

/** Alias — there is one app nav now. */
export const appSolutionsNav = solutionsNav;

/** Primary launch outcome slugs surfaced in the simplified sidebar. */
export function solutionsLaunchSlugs(): string[] {
  return ["missed-call-text-back"];
}
