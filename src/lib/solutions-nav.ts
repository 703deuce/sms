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

/** Paths that belong under the AI Receptionist sidebar section. */
export const RECEPTIONIST_SECTION_PREFIXES = ["/voice/receptionist", "/voice/agents"] as const;

export function isReceptionistSectionPath(pathname: string): boolean {
  return RECEPTIONIST_SECTION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function buildReceptionistNavChildren(agentId?: string | null): NavChild[] {
  const landing = "/voice/receptionist";
  const agentsList = "/voice/agents";
  if (!agentId) {
    return [
      { label: "Overview", href: landing },
      { label: "My Agents", href: agentsList },
      { label: "About Your Receptionist", href: "/voice/agents/new" },
      { label: "What It Should Do", href: agentsList },
      { label: "Connect integrations", href: agentsList },
      { label: "Advanced", href: agentsList },
      { label: "Voice & Test", href: agentsList },
    ];
  }
  return [
    { label: "Overview", href: landing },
    { label: "My Agents", href: agentsList },
    { label: "About Your Receptionist", href: `/voice/agents/${agentId}/about` },
    { label: "What It Should Do", href: `/voice/agents/${agentId}/capabilities` },
    { label: "Connect integrations", href: `/voice/agents/${agentId}/integrations` },
    { label: "Advanced", href: `/voice/agents/${agentId}/advanced` },
    { label: "Voice & Test", href: `/voice/agents/${agentId}/voice-test` },
  ];
}

export function buildProductNav(options: SolutionsNavOptions = {}): NavItem[] {
  const agentId =
    options.primaryVoiceAgentId != null && options.primaryVoiceAgentId !== ""
      ? options.primaryVoiceAgentId
      : null;

  return [
    { label: "Dashboard", href: "/outcomes", icon: LayoutDashboard },
    {
      label: "AI Receptionist",
      href: "/voice/receptionist",
      icon: AudioLines,
      children: buildReceptionistNavChildren(agentId),
    },
    { label: "Phone Numbers", href: "/numbers", icon: Hash },
    { label: "Settings", href: "/settings/business", icon: Settings },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Organizations", href: "/contacts/lists", icon: Building2 },
    { label: "Credentials", href: "/integrations/crm", icon: KeyRound },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    { label: "Affiliates", href: "/settings/billing", icon: Megaphone },
  ];
}

/** Launch sidebar — AI Receptionist expands to wizard shortcuts + My Agents. */
export function buildSolutionsNav(options: SolutionsNavOptions = {}): NavItem[] {
  return buildProductNav(options);
}

/** Static launch nav — used for titles / tests (no primary agent context). */
export const solutionsNav: NavItem[] = buildProductNav();

/** Alias — there is one app nav now. */
export const appSolutionsNav = solutionsNav;

/** Primary launch outcome slugs surfaced in the simplified sidebar. */
export function solutionsLaunchSlugs(): string[] {
  return ["missed-call-text-back"];
}
