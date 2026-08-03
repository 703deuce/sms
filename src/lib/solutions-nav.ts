import {
  AudioLines,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Phone,
  Puzzle,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { NavChild, NavGroup, NavItem, NavLink } from "@/lib/nav";
import {
  outcomeHref,
  outcomeSolutions,
  type OutcomeSolutionDef,
} from "@/lib/outcomes/registry";

export type SolutionNavInstance = {
  id: string;
  label: string;
  status: string;
  href: string;
  children?: NavLink[];
};

export type SolutionsNavOptions = {
  /** Injected receptionist / workflow instances keyed by outcome slug. */
  instancesBySolution?: Record<string, SolutionNavInstance[]>;
};

function solutionChildren(
  solution: OutcomeSolutionDef,
  instances: SolutionNavInstance[] | undefined,
): NavChild[] {
  const links: NavChild[] = [];

  for (const page of solution.pages) {
    links.push({
      label: page.label,
      href: outcomeHref(solution.slug, page.slug),
    });
  }

  const count = instances?.length ?? 0;
  if (count === 0) return links;

  if (count > 2) {
    // Prefer a count badge on Active Setups rather than listing dozens.
    const activeIdx = links.findIndex(
      (c) => !("type" in c && c.type === "group") && (c as NavLink).label === "Active Setups",
    );
    if (activeIdx >= 0) {
      (links[activeIdx] as NavLink).label = `Active Setups (${count})`;
    } else {
      links.splice(2, 0, {
        label: `Active Setups (${count})`,
        href: outcomeHref(solution.slug, "active"),
      });
    }
    return links;
  }

  const instanceGroup: NavGroup = {
    type: "group",
    label: "Your setups",
    children: instances!.map((inst) => ({
      label: `${inst.label} · ${inst.status}`,
      href: inst.href,
    })),
  };

  const setupIdx = links.findIndex(
    (c) => !("type" in c && c.type === "group") && (c as NavLink).label === "Set Up",
  );
  const insertAt = setupIdx >= 0 ? setupIdx + 1 : 1;
  links.splice(insertAt, 0, instanceGroup);
  return links;
}

function iconFor(slug: string): LucideIcon {
  if (slug.includes("appointment") || slug.includes("booking")) return CalendarDays;
  if (slug.includes("lead") || slug.includes("intake")) return Users;
  if (
    slug.startsWith("ai-") ||
    slug.includes("call") ||
    slug.includes("hours") ||
    slug.includes("overflow")
  ) {
    return AudioLines;
  }
  return Sparkles;
}

/**
 * Outcome-based Solutions sidebar.
 * Only the expanded top-level item reveals its children (accordion in Sidebar).
 */
export function buildSolutionsNav(options: SolutionsNavOptions = {}): NavItem[] {
  const instances = options.instancesBySolution ?? {};

  const callsAi = outcomeSolutions.filter((s) => s.category === "calls-ai");
  const sms = outcomeSolutions.filter((s) => s.category === "sms-messaging");

  const nav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/outcomes",
      icon: LayoutDashboard,
      children: [{ label: "Overview", href: "/outcomes" }],
    },
  ];

  for (const [index, solution] of callsAi.entries()) {
    nav.push({
      label: solution.title,
      href: outcomeHref(solution.slug),
      icon: iconFor(solution.slug),
      children: solutionChildren(solution, instances[solution.slug]),
      sectionLabel: index === 0 ? "Calls & AI" : undefined,
    });
  }

  for (const [index, solution] of sms.entries()) {
    nav.push({
      label: solution.title,
      href: outcomeHref(solution.slug),
      icon: MessageSquare,
      children: solutionChildren(solution, instances[solution.slug]),
      sectionLabel: index === 0 ? "SMS & Messaging" : undefined,
    });
  }

  nav.push(
    {
      label: "Team Inbox",
      href: "/inbox",
      icon: Inbox,
      sectionLabel: "Customers",
      children: [
        { label: "All Conversations", href: "/inbox" },
        { label: "Assigned to Me", href: "/inbox/mine" },
        { label: "Unassigned", href: "/inbox/unassigned" },
      ],
    },
    {
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      children: [
        { label: "All Contacts", href: "/contacts" },
        { label: "Lists & Segments", href: "/contacts/lists" },
        { label: "Imports", href: "/contacts/imports" },
        {
          type: "group",
          label: "Contact Settings",
          children: [
            { label: "Tags", href: "/contacts/tags" },
            { label: "Custom Fields", href: "/contacts/fields" },
            { label: "Validation", href: "/contacts/validation" },
            { label: "Unsubscribed", href: "/contacts/unsubscribed" },
            { label: "Blocked", href: "/contacts/blocked" },
            { label: "Invalid", href: "/contacts/invalid" },
          ],
        },
      ],
    },
    {
      label: "Lead Inbox",
      href: "/integrations/native/leads",
      icon: ClipboardList,
    },
    {
      label: "Pipeline",
      href: "/integrations/crm/pipeline",
      icon: BarChart3,
    },
    {
      label: "Appointments",
      href: "/integrations/native/appointments",
      icon: CalendarDays,
    },
    {
      label: "Tasks",
      href: "/integrations/native/tasks",
      icon: ClipboardList,
    },
    {
      label: "Phone",
      href: "/numbers",
      icon: Phone,
      sectionLabel: "Phone",
      children: [
        { label: "Phone Numbers", href: "/numbers" },
        { label: "Softphone", href: "/phone" },
        { label: "Call History", href: "/phone/calls" },
        {
          type: "group",
          label: "Routing",
          children: [
            { label: "Queues", href: "/phone/queues" },
            { label: "IVR", href: "/phone/ivr" },
            { label: "Inbound routing", href: "/voice/inbound-routing" },
            { label: "Phone settings", href: "/phone/settings" },
          ],
        },
      ],
    },
    {
      label: "Calendars",
      href: "/voice/calendars",
      icon: CalendarDays,
      sectionLabel: "Calendars",
      children: [
        { label: "Connections", href: "/voice/calendars" },
        { label: "Appointment Types", href: "/voice/calendars" },
        { label: "Appointments", href: "/integrations/native/appointments" },
      ],
    },
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
      sectionLabel: "Integrations",
      children: [
        { label: "App Directory", href: "/integrations" },
        { label: "Connected Apps", href: "/integrations/native" },
        { label: "CRM", href: "/integrations/crm" },
        { label: "Webhooks", href: "/integrations/webhooks" },
        { label: "API Keys", href: "/integrations/api" },
      ],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: BarChart3,
      sectionLabel: "Reports",
      children: [
        { label: "Overview", href: "/reports" },
        { label: "Calls", href: "/voice/analytics" },
        { label: "Appointments", href: "/integrations/native/appointments" },
        { label: "Leads", href: "/integrations/native/leads" },
        { label: "Messages", href: "/reports/messages" },
        { label: "Campaigns", href: "/reports/campaigns" },
        { label: "Usage", href: "/reports/usage" },
      ],
    },
    {
      label: "Compliance",
      href: "/compliance",
      icon: ShieldCheck,
      sectionLabel: "Compliance",
    },
    {
      label: "Advanced",
      href: "/voice/agents",
      icon: Wrench,
      sectionLabel: "Advanced",
      children: [
        { label: "Workflow Builder", href: "/automations/new" },
        { label: "Automations", href: "/automations" },
        { label: "Voice Agents", href: "/voice/agents" },
        { label: "Knowledge Bases", href: "/voice/knowledge" },
        { label: "Tools", href: "/voice/tools" },
        { label: "Testing Lab", href: "/voice/testing" },
        { label: "Surveys", href: "/surveys" },
        { label: "Growth Tools", href: "/grow/keywords" },
        {
          type: "group",
          label: "Developer Tools",
          children: [
            { label: "API Keys", href: "/integrations/api" },
            { label: "Webhooks", href: "/integrations/webhooks" },
            { label: "Developer Logs", href: "/integrations/logs" },
            { label: "Action Audit", href: "/integrations/native/audit" },
            { label: "AI Safety Policies", href: "/integrations/native/ai-policy" },
          ],
        },
      ],
    },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: "Settings",
    },
  );

  return nav;
}

/** Static solutions nav (no live instances) — used for titles / tests. */
export const solutionsNav: NavItem[] = buildSolutionsNav();
