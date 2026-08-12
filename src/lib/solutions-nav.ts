import {
  AudioLines,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  PhoneMissed,
  Puzzle,
  Settings,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { NavChild, NavItem } from "@/lib/nav";
import { outcomeHref } from "@/lib/outcomes/registry";

export type SolutionNavInstance = {
  id: string;
  label: string;
  status: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
};

export type SolutionsNavOptions = {
  /** Kept for shell compatibility; launch nav no longer surfaces instance shortcuts. */
  instancesBySolution?: Record<string, SolutionNavInstance[]>;
};

/**
 * Launch sidebar — AI receptionist + SMS only.
 * AI answers → collects/handles → optionally books → SMS follows up.
 */
export function buildSolutionsNav(_options: SolutionsNavOptions = {}): NavItem[] {
  return [
    {
      label: "Dashboard",
      href: "/outcomes",
      icon: LayoutDashboard,
    },
    {
      label: "AI Receptionist",
      href: "/voice/agents",
      icon: AudioLines,
      children: [
        { label: "My Agent", href: "/voice/agents" },
        { label: "Instructions", href: outcomeHref("answer-every-call", "call-handling") },
        { label: "Knowledge", href: "/voice/knowledge" },
        { label: "Actions", href: "/voice/tools" },
        { label: "Voice", href: outcomeHref("answer-every-call", "voice") },
        { label: "Test", href: "/voice/testing" },
      ],
    },
    {
      label: "Missed Call Text Back",
      href: outcomeHref("missed-call-text-back"),
      icon: PhoneMissed,
      children: [
        { label: "Setup", href: outcomeHref("missed-call-text-back", "setup") },
        { label: "Message", href: outcomeHref("missed-call-text-back", "sequence") },
        { label: "Rules", href: outcomeHref("missed-call-text-back", "triggers") },
        { label: "Activity", href: outcomeHref("missed-call-text-back", "results") },
      ],
    },
    {
      label: "Messages",
      href: "/inbox",
      icon: MessageSquare,
      children: [
        { label: "SMS", href: "/inbox" },
        { label: "Templates", href: "/templates" },
        { label: "Scheduled", href: "/campaigns/scheduled" },
        { label: "Sent", href: "/campaigns/completed" },
      ],
    },
    {
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      children: [
        { label: "All Contacts", href: "/contacts" },
        { label: "Lists", href: "/contacts/lists" },
        { label: "Tags", href: "/contacts/tags" },
        { label: "Import", href: "/contacts/imports" },
      ],
    },
    {
      label: "Appointments",
      href: "/integrations/native/appointments",
      icon: CalendarDays,
      children: [
        { label: "Appointments", href: "/integrations/native/appointments" },
        { label: "Calendar", href: "/campaigns/calendar" },
        { label: "Connections", href: "/voice/calendars" },
        { label: "Availability", href: "/voice/calendars" },
      ],
    },
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
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
      children: [
        { label: "Calendars", href: "/voice/calendars" },
        { label: "CRM", href: "/integrations/crm" },
        { label: "Webhooks", href: "/integrations/webhooks" },
      ],
    },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      children: [
        { label: "Business", href: "/settings/business" },
        { label: "AI", href: "/voice/settings" },
        { label: "Messaging", href: "/settings/messaging" },
        { label: "Appointments", href: "/voice/calendars" },
        { label: "Compliance", href: "/compliance" },
        { label: "Billing", href: "/settings/billing" },
      ],
    },
  ];
}

/** Static launch nav — used for titles / tests. */
export const solutionsNav: NavItem[] = buildSolutionsNav();

/** Alias — there is one app nav now. */
export const appSolutionsNav = solutionsNav;

/** Primary launch outcome slugs surfaced in the simplified sidebar. */
export function solutionsLaunchSlugs(): string[] {
  return ["answer-every-call", "missed-call-text-back"];
}
