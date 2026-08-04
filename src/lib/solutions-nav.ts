import {
  AudioLines,
  BarChart3,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageSquare,
  MousePointerClick,
  Phone,
  Puzzle,
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

function iconForSection(section: string, slug: string): LucideIcon {
  if (section === "AI Receptionist") return AudioLines;
  if (section === "SMS & Messaging") return MessageSquare;
  if (section === "Email") return Mail;
  if (section === "Phone") return Phone;
  if (section === "Automations") return Workflow;
  if (slug.includes("appointment") || slug.includes("booking")) return CalendarDays;
  return Sparkles;
}

type LaunchEntry = {
  slug: string;
  /** When set, link into the same solution with a channel focus (Email shortcuts). */
  channel?: "email" | "sms";
  /**
   * Email (and similar) shortcuts open the same solution without duplicating
   * the full management tree under a second section.
   */
  shortcut?: boolean;
  /** Optional label override for the nav row. */
  label?: string;
};

type SectionDef = {
  label: string;
  entries: LaunchEntry[];
};

/**
 * Section headers = product areas of the platform.
 * Entries = solution-based problems being solved.
 */
const LAUNCH_SECTIONS: SectionDef[] = [
  {
    label: "AI Receptionist",
    entries: [
      { slug: "answer-every-call" },
      { slug: "missed-overflow" },
      { slug: "after-hours" },
      { slug: "appointment-booking" },
      { slug: "lead-capture" },
      { slug: "lead-qualification" },
      { slug: "service-intake" },
      { slug: "customer-support" },
    ],
  },
  {
    label: "SMS & Messaging",
    entries: [
      { slug: "missed-call-text-back" },
      { slug: "instant-lead-response" },
      { slug: "lead-follow-up" },
      { slug: "estimate-follow-up" },
      { slug: "old-lead-reactivation" },
      { slug: "appointment-reminders" },
      { slug: "review-requests" },
      { slug: "client-onboarding" }, // Welcome New Customers
      { slug: "customer-follow-up", label: "Follow Up With Customers" },
      { slug: "payment-follow-up" },
      { slug: "promotional-broadcast" },
      { slug: "customer-reactivation" },
      { slug: "referral-campaigns" },
      { slug: "event-offer-campaigns" },
    ],
  },
];

function staticSectionItems(
  sectionLabel: string,
  icon: LucideIcon,
  items: Array<{ label: string; href: string; children?: NavChild[] }>,
): NavItem[] {
  return items.map((item, index) => ({
    label: item.label,
    href: item.href,
    icon,
    children: item.children,
    sectionLabel: index === 0 ? sectionLabel : undefined,
  }));
}

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
        sectionLabel: first ? section.label : undefined,
      });
      first = false;
    }

    if (section.label === "SMS & Messaging") {
      nav.push({
        label: "Run a Contest",
        href: "/grow/contests",
        icon: MessageSquare,
      });
    }
  }

  nav.push(
    ...staticSectionItems("Connect With Customers", MousePointerClick, [
      { label: "Forms", href: "/grow/forms" },
      { label: "Website Popups", href: "/grow/popups" },
      { label: "Signup Pages", href: "/grow/pages" },
      { label: "QR Codes", href: "/grow/qr-codes" },
      { label: "Click-to-Text", href: "/grow/click-to-text" },
      { label: "Contact Cards", href: "/grow/contact-cards" },
    ]),
    ...staticSectionItems("Phone", Phone, [
      { label: "Make & Receive Calls", href: "/phone" },
      { label: "Phone Numbers", href: "/numbers" },
      { label: "Call History", href: "/phone/calls" },
      { label: "Voicemail", href: "/phone/settings" },
    ]),
    ...staticSectionItems("Email", Mail, [
      { label: "Email Activity", href: "/reports/messages" },
      { label: "Sent Emails", href: "/campaigns" },
      { label: "Scheduled Emails", href: "/campaigns/scheduled" },
      { label: "Drafts", href: "/campaigns/drafts" },
      { label: "Templates", href: "/templates" },
      { label: "Email Settings", href: "/settings/email-to-sms" },
    ]),
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
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      children: [
        { label: "All Contacts", href: "/contacts" },
        { label: "Lists & Segments", href: "/contacts/lists" },
        { label: "Imports", href: "/contacts/imports" },
        { label: "Contact Settings", href: "/contacts/fields" },
      ],
    },
    {
      label: "Calendars",
      href: "/voice/calendars",
      icon: CalendarDays,
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
      children: [
        { label: "Overview", href: "/reports" },
        { label: "Calls", href: "/voice/analytics" },
        { label: "Messages", href: "/reports/messages" },
        { label: "Appointments", href: "/integrations/native/appointments" },
        { label: "Inquiries", href: "/integrations/native/leads" },
        { label: "Campaigns", href: "/reports/campaigns" },
        { label: "Inquiry Sources", href: "/integrations/native/leads" },
        { label: "Usage", href: "/reports/usage" },
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
      label: "Advanced",
      href: "/automations",
      icon: Wrench,
      children: [
        {
          type: "group",
          label: "Automations",
          children: [
            { label: "Flows", href: "/automations" },
            { label: "Templates", href: "/automations" },
            { label: "Builder", href: "/automations/new" },
            { label: "Logs", href: "/automations" },
          ],
        },
        { label: "Voice Agents", href: "/voice/agents" },
        { label: "Knowledge Bases", href: "/voice/knowledge" },
        { label: "Testing Lab", href: "/voice/testing" },
        {
          type: "group",
          label: "Developer Tools",
          children: [
            { label: "API Keys", href: "/integrations/api" },
            { label: "Webhooks", href: "/integrations/webhooks" },
            { label: "Developer Logs", href: "/integrations/logs" },
            { label: "Action Audit", href: "/integrations/native/audit" },
            { label: "AI Safety", href: "/integrations/native/ai-policy" },
          ],
        },
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
