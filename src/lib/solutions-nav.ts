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

function pageBySlug(solution: OutcomeSolutionDef, slug: string) {
  return solution.pages.find((p) => p.slug === slug);
}

function instanceShortcutLinks(
  solution: OutcomeSolutionDef,
  instanceId: string,
): NavLink[] {
  const slugs = solution.instanceShortcutSlugs;
  if (!slugs?.length) {
    return [
      { label: "Open", href: `/voice/agents/${instanceId}` },
      {
        label: "Results",
        href: outcomeHref(solution.slug, "results"),
      },
    ];
  }
  return slugs
    .map((slug) => {
      const page = pageBySlug(solution, slug);
      if (!page) return null;
      return {
        label: page.label,
        // Instance-scoped management still uses the solution page; agent context via query.
        href: `${outcomeHref(solution.slug, slug)}?agentId=${encodeURIComponent(instanceId)}`,
      } satisfies NavLink;
    })
    .filter((x): x is NavLink => Boolean(x));
}

/**
 * Adaptive solution submenu:
 * - No setups: Overview + Set Up
 * - 1–2 setups: Overview, + Set Up Another, each instance with shortcuts
 * - 3+ setups: Overview, + Set Up Another, Your Setups (N)
 *
 * Solutions without navRole metadata keep the full page list (legacy/SMS).
 */
function solutionChildren(
  solution: OutcomeSolutionDef,
  instances: SolutionNavInstance[] | undefined,
): NavChild[] {
  const hasRoles = solution.pages.some((p) => p.navRole);
  const count = instances?.length ?? 0;
  const setupPage = solution.pages.find((p) => p.kind === "setup");
  const listPage = solution.pages.find((p) => p.navRole === "list" || p.kind === "active");
  const listLabel = solution.setupsListLabel || listPage?.label || "Your Setups";

  if (!hasRoles) {
    // Legacy / SMS solutions: show all pages; light instance injection.
    const links: NavChild[] = solution.pages.map((page) => ({
      label: page.label,
      href: outcomeHref(solution.slug, page.slug),
    }));
    if (count === 0) return links;
    if (count > 2) {
      const activeIdx = links.findIndex(
        (c) => !("type" in c && c.type === "group") && /active|setups|workflows/i.test((c as NavLink).label),
      );
      if (activeIdx >= 0) {
        (links[activeIdx] as NavLink).label = `${(links[activeIdx] as NavLink).label} (${count})`;
      }
      return links;
    }
    const group: NavGroup = {
      type: "group",
      label: "Your setups",
      children: instances!.map((inst) => ({
        label: `${inst.label} · ${inst.status}`,
        href: inst.href,
      })),
    };
    links.splice(2, 0, group);
    return links;
  }

  const children: NavChild[] = [
    { label: "Overview", href: outcomeHref(solution.slug) },
  ];

  if (setupPage) {
    children.push({
      label: count > 0 ? "+ Set Up Another" : "Set Up",
      href: outcomeHref(solution.slug, setupPage.slug),
    });
  }

  if (count === 0) {
    return children;
  }

  if (count > 2) {
    children.push({
      label: `${listLabel} (${count})`,
      href: outcomeHref(solution.slug, listPage?.slug || "active"),
    });
    return children;
  }

  for (const inst of instances!) {
    children.push({
      type: "group",
      label: `${inst.label} · ${inst.status}`,
      children: [
        { label: "Open", href: inst.href },
        ...instanceShortcutLinks(solution, inst.id),
      ],
    });
  }

  return children;
}

function iconFor(slug: string): LucideIcon {
  if (slug.includes("appointment") || slug.includes("booking")) return CalendarDays;
  if (slug.includes("lead") || slug.includes("intake")) return Users;
  if (
    slug.startsWith("ai-") ||
    slug.includes("call") ||
    slug.includes("hours") ||
    slug.includes("overflow") ||
    slug.includes("answer")
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

  const receptionistHub = outcomeSolutions.find((s) => s.slug === "ai-receptionist");
  const callOutcomes = outcomeSolutions.filter(
    (s) => s.category === "calls-ai" && s.slug !== "ai-receptionist",
  );
  const sms = outcomeSolutions.filter((s) => s.category === "sms-messaging");

  const nav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/outcomes",
      icon: LayoutDashboard,
      children: [{ label: "Overview", href: "/outcomes" }],
    },
  ];

  for (const [index, solution] of callOutcomes.entries()) {
    nav.push({
      label: solution.title,
      href: outcomeHref(solution.slug),
      icon: iconFor(solution.slug),
      children: solutionChildren(solution, instances[solution.slug]),
      sectionLabel: index === 0 ? "AI Receptionist" : undefined,
    });
  }

  if (receptionistHub) {
    const receptionistInstances = instances["ai-receptionist"] ?? [];
    nav.push({
      label: "Your Receptionists",
      href: outcomeHref("ai-receptionist"),
      icon: AudioLines,
      children:
        receptionistInstances.length > 0
          ? receptionistInstances.slice(0, 2).map((inst) => ({
              label: `${inst.label} · ${inst.status}`,
              href: inst.href,
            }))
          : [
              { label: "Overview", href: outcomeHref("ai-receptionist") },
              {
                label: "Create receptionist",
                href:
                  receptionistHub.setupHref ||
                  outcomeHref("ai-receptionist"),
              },
            ],
    });
  }

  for (const [index, solution] of sms.entries()) {
    nav.push({
      label: solution.title,
      href: outcomeHref(solution.slug),
      icon: MessageSquare,
      children: solutionChildren(solution, instances[solution.slug]),
      sectionLabel: index === 0 ? "Texts & Follow-Up" : undefined,
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
