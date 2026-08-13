import {
  AudioLines,
  Calendar,
  Hash,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  Puzzle,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
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
  inboxBadge?: number;
};

/** Paths that belong under the AI Receptionist sidebar section. */
export const RECEPTIONIST_SECTION_PREFIXES = [
  "/voice/receptionist",
  "/voice/agents",
] as const;

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
      { label: "Connect Integrations", href: agentsList },
      { label: "Advanced", href: agentsList },
      { label: "Voice & Test", href: agentsList },
    ];
  }
  return [
    { label: "Overview", href: landing },
    { label: "My Agents", href: agentsList },
    { label: "About Your Receptionist", href: `/voice/agents/${agentId}/about` },
    { label: "What It Should Do", href: `/voice/agents/${agentId}/capabilities` },
    { label: "Connect Integrations", href: `/voice/agents/${agentId}/integrations` },
    { label: "Advanced", href: `/voice/agents/${agentId}/advanced` },
    { label: "Voice & Test", href: `/voice/agents/${agentId}/voice-test` },
  ];
}

export function buildProductNav(options: SolutionsNavOptions = {}): NavItem[] {
  const agentId =
    options.primaryVoiceAgentId != null && options.primaryVoiceAgentId !== ""
      ? options.primaryVoiceAgentId
      : null;
  const inboxBadge = options.inboxBadge ?? 0;

  return [
    { label: "Dashboard", href: "/outcomes", icon: LayoutDashboard },
    {
      label: "AI Receptionist",
      href: "/voice/receptionist",
      icon: AudioLines,
      children: buildReceptionistNavChildren(agentId),
    },
    { label: "Calls", href: "/voice/calls", icon: PhoneCall, emphasize: true },
    {
      label: "SMS",
      href: "/inbox",
      icon: MessageSquare,
      badge: inboxBadge > 0 ? inboxBadge : undefined,
      children: [
        { label: "Inbox", href: "/inbox" },
        { label: "Broadcast", href: "/send/quick" },
        { label: "Campaigns", href: "/campaigns" },
        { label: "Templates", href: "/templates" },
      ],
    },
    { label: "Contacts", href: "/contacts", icon: Users },
    {
      label: "Automations",
      href: "/automations",
      icon: Workflow,
      children: [
        { label: "Flows", href: "/automations" },
        { label: "Templates", href: "/automations/templates" },
        { label: "Logs", href: "/automations/logs" },
      ],
    },
    {
      label: "Appointments",
      href: "/integrations/native/appointments",
      icon: Calendar,
      children: [
        { label: "Bookings", href: "/integrations/native/appointments" },
        { label: "Calendars", href: "/voice/calendars" },
      ],
    },
    {
      label: "Phone Numbers",
      href: "/numbers",
      icon: Hash,
      children: [
        { label: "My Numbers", href: "/numbers" },
        { label: "Buy Number", href: "/numbers/buy" },
        { label: "Port Number", href: "/numbers/port" },
      ],
    },
    {
      label: "Compliance",
      href: "/compliance",
      icon: ShieldCheck,
      children: [
        { label: "A2P Registration", href: "/compliance" },
        { label: "Consent & Opt-Outs", href: "/compliance/consent" },
      ],
    },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      children: [
        { label: "Business", href: "/settings/business" },
        { label: "Messaging", href: "/settings/messaging" },
        { label: "Notifications", href: "/settings/notifications" },
        { label: "Usage & Billing", href: "/reports/usage" },
        { label: "Security", href: "/settings/security" },
        { label: "Team", href: "/settings/users" },
      ],
    },
  ];
}

/** Launch sidebar — simplified product nav. */
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
