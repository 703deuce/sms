import {
  AudioLines,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Megaphone,
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
      { label: "Results", href: outcomeHref(solution.slug, "results") },
    ];
  }
  // Keep instance menus tight: most-used settings + test + results.
  const preferred = slugs.filter((s) =>
    /^(test|results|ring-rules|hours|calendars|triggers|sources|schedule|messages|eligibility)$/.test(
      s,
    ),
  );
  const shortlist = (preferred.length ? preferred : slugs).slice(0, 6);
  return shortlist
    .map((slug) => {
      const page = pageBySlug(solution, slug);
      if (!page) return null;
      return {
        label: page.label,
        href: `${outcomeHref(solution.slug, slug)}?agentId=${encodeURIComponent(instanceId)}`,
      } satisfies NavLink;
    })
    .filter((x): x is NavLink => Boolean(x));
}

/**
 * Always show the full permanent management submenu so customers can browse
 * what a solution includes before setup. After setup:
 * - Rename Set Up → + Set Up Another
 * - 1–2 instances: surface them under Set Up with quick shortcuts
 * - 3+ instances: badge the inventory page as Your Setups (N)
 */
function solutionChildren(
  solution: OutcomeSolutionDef,
  instances: SolutionNavInstance[] | undefined,
): NavChild[] {
  const count = instances?.length ?? 0;
  const children: NavChild[] = [];

  for (const page of solution.pages) {
    const isSetup = page.kind === "setup";
    const isList = page.navRole === "list" || page.kind === "active";
    let label = page.label;
    if (isSetup && count > 0) label = "+ Set Up Another";
    if (isList && count > 2) {
      label = `${solution.setupsListLabel || page.label} (${count})`;
    }
    children.push({
      label,
      href: outcomeHref(solution.slug, page.slug),
    });
  }

  if (count === 0 || count > 2) return children;

  // 1–2 setups: insert named instances right after Set Up / Create.
  const setupIdx = children.findIndex(
    (c) =>
      !("type" in c && c.type === "group") &&
      (/^\+ Set Up Another$|^Set Up$|^Create /i.test((c as NavLink).label)),
  );
  const insertAt = setupIdx >= 0 ? setupIdx + 1 : 1;
  const instanceGroups: NavGroup[] = instances!.map((inst) => ({
    type: "group",
    label: `${inst.label} · ${inst.status}`,
    children: [
      { label: "Open", href: inst.href },
      ...instanceShortcutLinks(solution, inst.id),
    ],
  }));
  children.splice(insertAt, 0, ...instanceGroups);
  return children;
}

function iconFor(slug: string, category: string): LucideIcon {
  if (category === "marketing") return Megaphone;
  if (category === "customer-experience") return Sparkles;
  if (category === "leads-follow-up") return MessageSquare;
  if (slug.includes("appointment") || slug.includes("booking")) return CalendarDays;
  if (slug.includes("lead") || slug.includes("intake") || slug.includes("dispatch")) {
    return Users;
  }
  if (
    slug.includes("call") ||
    slug.includes("hours") ||
    slug.includes("overflow") ||
    slug.includes("answer") ||
    slug.includes("support") ||
    slug.includes("reception")
  ) {
    return AudioLines;
  }
  return Sparkles;
}

type SectionDef = {
  label: string;
  category: OutcomeSolutionDef["category"];
  /** Explicit slug order for the launch menu. */
  slugs: string[];
};

const LAUNCH_SECTIONS: SectionDef[] = [
  {
    label: "Calls & AI",
    category: "calls-ai",
    slugs: [
      "answer-every-call",
      "missed-overflow",
      "after-hours",
      "appointment-booking",
      "lead-capture",
      "lead-qualification",
      "service-intake",
      "customer-support",
    ],
  },
  {
    label: "Leads & Follow-Up",
    category: "leads-follow-up",
    slugs: [
      "instant-lead-response",
      "missed-call-text-back",
      "lead-follow-up",
      "estimate-follow-up",
      "old-lead-reactivation",
    ],
  },
  {
    label: "Customer Experience",
    category: "customer-experience",
    slugs: [
      "appointment-reminders",
      "review-requests",
      "customer-follow-up",
      "client-onboarding",
      "payment-follow-up",
    ],
  },
  {
    label: "Marketing",
    category: "marketing",
    slugs: [
      "promotional-broadcast",
      "customer-reactivation",
      "referral-campaigns",
      "event-offer-campaigns",
    ],
  },
];

/**
 * Outcome-based Solutions sidebar.
 * Only the expanded top-level item reveals its children (accordion in Sidebar).
 */
export function buildSolutionsNav(options: SolutionsNavOptions = {}): NavItem[] {
  const instances = options.instancesBySolution ?? {};
  const bySlug = new Map(outcomeSolutions.map((s) => [s.slug, s]));

  const nav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/outcomes",
      icon: LayoutDashboard,
    },
  ];

  for (const section of LAUNCH_SECTIONS) {
    let first = true;
    for (const slug of section.slugs) {
      const solution = bySlug.get(slug);
      if (!solution) continue;
      nav.push({
        label: solution.title,
        href: outcomeHref(solution.slug),
        icon: iconFor(solution.slug, section.category),
        children: solutionChildren(solution, instances[solution.slug]),
        sectionLabel: first ? section.label : undefined,
      });
      first = false;
    }
  }

  nav.push(
    {
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      sectionLabel: "Shared",
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
      label: "Phone Numbers",
      href: "/numbers",
      icon: Phone,
    },
    {
      label: "Call History",
      href: "/phone/calls",
      icon: Phone,
    },
    {
      label: "Calendars",
      href: "/voice/calendars",
      icon: CalendarDays,
    },
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
    },
    {
      label: "Reports",
      href: "/reports",
      icon: BarChart3,
    },
    {
      label: "Compliance",
      href: "/compliance",
      icon: ShieldCheck,
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
