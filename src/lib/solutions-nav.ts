import {
  AudioLines,
  BarChart3,
  Bot,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  Phone,
  PhoneCall,
  Puzzle,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
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

function withQuery(href: string, query: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  if (!qs) return href;
  return href.includes("?") ? `${href}&${qs}` : `${href}?${qs}`;
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
  channel?: string,
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
    const href = channel
      ? withQuery(outcomeHref(solution.slug, page.slug), { channel })
      : outcomeHref(solution.slug, page.slug);
    children.push({ label, href });
  }

  if (count === 0 || count > 2) return children;

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

function iconForSection(section: string, slug: string): LucideIcon {
  if (section === "AI Receptionist") return AudioLines;
  if (section === "SMS & Messaging") return MessageSquare;
  if (slug.includes("appointment") || slug.includes("booking")) return CalendarDays;
  return Sparkles;
}

type LaunchEntry = {
  slug: string;
  channel?: "email" | "sms";
  shortcut?: boolean;
  label?: string;
};

type SectionDef = {
  label: string;
  entries: LaunchEntry[];
};

/**
 * Packaged solution catalog (13 items).
 * Wizards create real underlying agents / AutomationFlow / campaigns.
 */
const LAUNCH_SECTIONS: SectionDef[] = [
  {
    label: "AI Receptionist",
    entries: [
      { slug: "answer-every-call" },
      { slug: "missed-overflow" },
      { slug: "after-hours" },
      { slug: "appointment-booking" },
      { slug: "lead-capture", label: "Capture & Screen Inquiries" },
    ],
  },
  {
    label: "SMS & Messaging",
    entries: [
      { slug: "missed-call-text-back" },
      { slug: "instant-lead-response", label: "Respond & Follow Up" },
      { slug: "estimate-follow-up" },
      { slug: "appointment-reminders" },
      { slug: "review-requests" },
      { slug: "old-lead-reactivation" },
      { slug: "customer-reactivation" },
      {
        slug: "promotional-broadcast",
        label: "Send Promotions & Announcements",
      },
    ],
  },
];

function staticSectionItems(
  opts: {
    sectionLabel?: string;
    areaLabel?: string;
  },
  icon: LucideIcon,
  items: Array<{ label: string; href: string; children?: NavChild[] }>,
): NavItem[] {
  return items.map((item, index) => ({
    label: item.label,
    href: item.href,
    icon,
    children: item.children,
    sectionLabel: index === 0 ? opts.sectionLabel : undefined,
    areaLabel: index === 0 ? opts.areaLabel : undefined,
  }));
}

/**
 * Single product sidebar (no Platform/Solutions switch).
 * Catalog creates agents · My Agents inventories them · Automations edits flows.
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
    {
      label: "My Agents",
      href: "/systems",
      icon: Bot,
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
      label: "My Numbers",
      href: "/my-numbers",
      icon: Phone,
    },
  ];

  for (const section of LAUNCH_SECTIONS) {
    let firstInArea = true;
    for (const entry of section.entries) {
      const solution = bySlug.get(entry.slug);
      if (!solution) continue;
      const href = entry.channel
        ? withQuery(outcomeHref(solution.slug), { channel: entry.channel })
        : outcomeHref(solution.slug);
      nav.push({
        label: entry.label || solution.title,
        href,
        icon: iconForSection(section.label, solution.slug),
        children: entry.shortcut
          ? undefined
          : solutionChildren(solution, instances[solution.slug], entry.channel),
        // No "Solutions" band — AI Receptionist / SMS & Messaging are the areas.
        areaLabel: firstInArea ? section.label : undefined,
      });
      firstInArea = false;
    }
  }

  nav.push(
    ...staticSectionItems(
      { areaLabel: "Connect With Customers" },
      MousePointerClick,
      [
        { label: "Forms", href: "/grow/forms" },
        { label: "Website Popups", href: "/grow/popups" },
        { label: "Signup Pages", href: "/grow/pages" },
        { label: "QR Codes", href: "/grow/qr-codes" },
        { label: "Click-to-Text", href: "/grow/click-to-text" },
        { label: "Contact Cards", href: "/grow/contact-cards" },
        { label: "Text-to-Pay", href: "/messaging/payments" },
      ],
    ),
    {
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      children: [
        { label: "All Conversations", href: "/inbox" },
        { label: "Assigned to Me", href: "/inbox/mine" },
        { label: "Unassigned", href: "/inbox/unassigned" },
      ],
    },
    {
      label: "Calls",
      href: "/phone/calls",
      icon: PhoneCall,
      children: [
        { label: "All Calls", href: "/phone/calls" },
        { label: "Conversations", href: "/inbox" },
        { label: "Voicemails", href: "/phone/settings" },
      ],
    },
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: Megaphone,
      children: [
        { label: "All Campaigns", href: "/campaigns" },
        { label: "Scheduled", href: "/campaigns/scheduled" },
        { label: "Drafts", href: "/campaigns/drafts" },
        { label: "Running", href: "/campaigns" },
        { label: "Completed", href: "/campaigns/completed" },
        { label: "Templates", href: "/templates" },
      ],
    },
    {
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      children: [
        { label: "All Contacts", href: "/contacts" },
        { label: "Lists", href: "/contacts/lists" },
        { label: "Segments", href: "/contacts/segments" },
        { label: "Tags", href: "/contacts/tags" },
        { label: "Custom Fields", href: "/contacts/fields" },
        { label: "Imports", href: "/contacts/imports" },
        { label: "Sources", href: "/grow/sources" },
        {
          type: "group",
          label: "Contact Settings",
          children: [
            { label: "Validation", href: "/contacts/validation" },
            { label: "Unsubscribed", href: "/contacts/unsubscribed" },
            { label: "Blocked", href: "/contacts/blocked" },
            { label: "Invalid", href: "/contacts/invalid" },
            { label: "Consent Status", href: "/compliance/consent" },
          ],
        },
      ],
    },
    {
      label: "Calendar",
      href: "/campaigns/calendar",
      icon: CalendarDays,
      children: [
        { label: "Calendar", href: "/campaigns/calendar" },
        { label: "Appointments", href: "/integrations/native/appointments" },
        { label: "Connections", href: "/voice/calendars" },
      ],
    },
    {
      label: "Phone",
      href: "/phone",
      icon: Phone,
      children: [
        { label: "Make & Receive Calls", href: "/phone" },
        { label: "Phone Numbers", href: "/numbers" },
        { label: "Phone Settings", href: "/phone/settings" },
      ],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: BarChart3,
      children: [
        { label: "Overview", href: "/reports" },
        { label: "Calls", href: "/voice/analytics" },
        { label: "Messages", href: "/reports/messages" },
        { label: "Campaigns", href: "/reports/campaigns" },
        { label: "Appointments", href: "/integrations/native/appointments" },
        { label: "Inquiries", href: "/integrations/native/leads" },
        { label: "Sources", href: "/grow/sources" },
        { label: "Automations", href: "/reports/automations" },
        { label: "Usage", href: "/reports/usage" },
      ],
    },
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
      children: [
        { label: "App Directory", href: "/integrations" },
        { label: "Connected Apps", href: "/integrations/native" },
        { label: "CRM", href: "/integrations/crm" },
        { label: "Calendars", href: "/voice/calendars" },
        { label: "Webhooks", href: "/integrations/webhooks" },
        { label: "API Keys", href: "/integrations/api" },
      ],
    },
    {
      label: "Compliance",
      href: "/compliance",
      icon: ShieldCheck,
      children: [
        { label: "Messaging Registration", href: "/compliance/campaign" },
        { label: "Consent & Opt-Outs", href: "/compliance/consent" },
        { label: "Calling Compliance", href: "/compliance" },
        { label: "Recording Disclosures", href: "/voice/settings" },
      ],
    },
    {
      label: "Phone & Routing",
      href: "/phone/queues",
      icon: Route,
      sectionLabel: "Advanced",
      children: [
        { label: "Inbound Routing", href: "/phone/queues" },
        { label: "Business Hours", href: "/voice/settings" },
        { label: "Overflow & Fallback", href: "/phone/queues" },
        { label: "VIP Rules", href: "/phone/queues" },
        { label: "AI Handoff", href: "/voice/agents" },
        { label: "Queues", href: "/phone/queues" },
        { label: "Phone Menus", href: "/phone/ivr" },
        { label: "Routing Logs", href: "/integrations/logs" },
      ],
    },
    {
      label: "Developer Tools",
      href: "/integrations/api",
      icon: Wrench,
      children: [
        { label: "API Keys", href: "/integrations/api" },
        { label: "Webhooks", href: "/integrations/webhooks" },
        { label: "Developer Logs", href: "/integrations/logs" },
        { label: "Action Audit", href: "/integrations/native/audit" },
        { label: "AI Safety", href: "/integrations/native/ai-policy" },
      ],
    },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
    },
  );

  return nav;
}

/** Static solutions nav (no live instances) — used for titles / tests. */
export const solutionsNav: NavItem[] = buildSolutionsNav();

/** Alias — there is one app nav now. */
export const appSolutionsNav = solutionsNav;

/** Slugs that appear as primary (non-shortcut) Solutions launch entries. */
export function solutionsLaunchSlugs(): string[] {
  const slugs = new Set<string>();
  for (const section of LAUNCH_SECTIONS) {
    for (const entry of section.entries) {
      if (!entry.shortcut) slugs.add(entry.slug);
    }
  }
  return [...slugs];
}
