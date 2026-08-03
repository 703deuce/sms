/**
 * Solutions layer — guided entry points over existing Messaging / Voice /
 * Automations / Contacts / Reports systems. These do not replace platform tools.
 */

export type SolutionLink = {
  label: string;
  href: string;
};

export type SolutionDef = {
  slug: string;
  title: string;
  summary: string;
  href: string;
  uses: SolutionLink[];
  cta?: SolutionLink;
};

export type SolutionCategory = {
  slug: string;
  title: string;
  summary: string;
  href: string;
  solutions: SolutionDef[];
};

const base = "/solutions";

export const solutionCategories: SolutionCategory[] = [
  {
    slug: "lead-recovery",
    title: "Lead Recovery",
    summary: "Capture and follow up on missed opportunities before they go cold.",
    href: `${base}/lead-recovery`,
    solutions: [
      {
        slug: "missed-call-text-back",
        title: "Missed Call Text Back",
        summary:
          "Automatically text people who called and couldn’t reach you, then route replies into Inbox.",
        href: `${base}/lead-recovery/missed-call-text-back`,
        uses: [
          { label: "Inbound routing", href: "/voice/inbound-routing" },
          { label: "Automations", href: "/automations" },
          { label: "Inbox", href: "/inbox" },
        ],
        cta: { label: "Open inbound routing", href: "/voice/inbound-routing" },
      },
      {
        slug: "lead-follow-up",
        title: "Lead Follow-Up",
        summary: "Run timed SMS follow-up sequences for new leads from forms, keywords, or CRM.",
        href: `${base}/lead-recovery/lead-follow-up`,
        uses: [
          { label: "Automations", href: "/automations" },
          { label: "Campaigns", href: "/campaigns" },
          { label: "Contacts", href: "/contacts" },
        ],
        cta: { label: "Open automations", href: "/automations" },
      },
      {
        slug: "customer-reactivation",
        title: "Customer Reactivation",
        summary: "Win back quiet contacts with segmented campaigns and suppression-safe sends.",
        href: `${base}/lead-recovery/customer-reactivation`,
        uses: [
          { label: "Segments", href: "/contacts/segments" },
          { label: "Campaigns", href: "/campaigns" },
          { label: "Unsubscribed", href: "/contacts/unsubscribed" },
        ],
        cta: { label: "Open segments", href: "/contacts/segments" },
      },
    ],
  },
  {
    slug: "ai-call-handling",
    title: "AI Call Handling",
    summary: "Put AI on the phone for answering, after-hours, intake, and appointments.",
    href: `${base}/ai-call-handling`,
    solutions: [
      {
        slug: "ai-answering-machine",
        title: "AI Answering Machine",
        summary: "Publish a receptionist agent on your DID with CRM tools and human transfer.",
        href: `${base}/ai-call-handling/ai-answering-machine`,
        uses: [
          { label: "Agents", href: "/voice/agents" },
          { label: "Inbound routing", href: "/voice/inbound-routing" },
          { label: "Phone numbers", href: "/numbers" },
        ],
        cta: { label: "Open AI agents", href: "/voice/agents" },
      },
      {
        slug: "after-hours-assistant",
        title: "After-Hours Assistant",
        summary: "Route nights and weekends to AI, then escalate to your team when needed.",
        href: `${base}/ai-call-handling/after-hours-assistant`,
        uses: [
          { label: "Inbound routing", href: "/voice/inbound-routing" },
          { label: "Agents", href: "/voice/agents" },
          { label: "Business Phone queues", href: "/phone/queues" },
        ],
        cta: { label: "Configure inbound routing", href: "/voice/inbound-routing" },
      },
      {
        slug: "lead-intake-assistant",
        title: "Lead Intake Assistant",
        summary: "Collect name, need, and callback details, then sync to CRM / lead inbox.",
        href: `${base}/ai-call-handling/lead-intake-assistant`,
        uses: [
          { label: "Agents", href: "/voice/agents" },
          { label: "Lead inbox", href: "/integrations/native/leads" },
          { label: "CRM", href: "/integrations/crm" },
        ],
        cta: { label: "Open agents", href: "/voice/agents" },
      },
      {
        slug: "appointment-assistant",
        title: "Answer Calls and Book Appointments",
        summary:
          "Answer incoming calls, respond to questions, check availability, book appointments, and transfer callers when necessary.",
        href: `${base}/ai-call-handling/appointment-assistant`,
        uses: [
          { label: "Phone", href: "/phone" },
          { label: "AI Voice agents", href: "/voice/agents" },
          { label: "Calendars", href: "/voice/calendars" },
          { label: "Appointments", href: "/integrations/native/appointments" },
        ],
        cta: {
          label: "Set Up",
          href: `${base}/ai-call-handling/appointment-assistant/setup`,
        },
      },
    ],
  },
  {
    slug: "customer-growth",
    title: "Customer Growth",
    summary: "Automate reviews, reminders, and surveys that keep customers engaged.",
    href: `${base}/customer-growth`,
    solutions: [
      {
        slug: "automated-review-requests",
        title: "Automated Review Requests",
        summary: "Trigger review-request SMS after jobs, calls, or appointments.",
        href: `${base}/customer-growth/automated-review-requests`,
        uses: [
          { label: "Automations", href: "/automations" },
          { label: "Templates", href: "/templates" },
          { label: "Surveys", href: "/surveys" },
        ],
        cta: { label: "Open automations", href: "/automations" },
      },
      {
        slug: "appointment-reminders",
        title: "Appointment Reminders",
        summary: "Send confirmation and reminder texts tied to appointment data.",
        href: `${base}/customer-growth/appointment-reminders`,
        uses: [
          { label: "Appointments", href: "/integrations/native/appointments" },
          { label: "Automations", href: "/automations" },
          { label: "Templates", href: "/templates" },
        ],
        cta: { label: "Open appointments", href: "/integrations/native/appointments" },
      },
      {
        slug: "customer-surveys",
        title: "Customer Surveys",
        summary: "Collect NPS and poll feedback over SMS, then report on results.",
        href: `${base}/customer-growth/customer-surveys`,
        uses: [
          { label: "Surveys", href: "/surveys" },
          { label: "NPS", href: "/surveys?type=nps" },
          { label: "Reports", href: "/reports" },
        ],
        cta: { label: "Open surveys", href: "/surveys" },
      },
    ],
  },
  {
    slug: "team-performance",
    title: "Team Performance",
    summary: "Use call activity and quality signals to coach the team.",
    href: `${base}/team-performance`,
    solutions: [
      {
        slug: "sales-call-intelligence",
        title: "Sales Call Intelligence",
        summary: "Review call history, recordings, and outcomes from Business Phone and AI Voice.",
        href: `${base}/team-performance/sales-call-intelligence`,
        uses: [
          { label: "Call history", href: "/phone/calls" },
          { label: "AI Voice calls", href: "/voice/calls" },
          { label: "Analytics", href: "/voice/analytics" },
        ],
        cta: { label: "Open call history", href: "/phone/calls" },
      },
      {
        slug: "call-quality-coaching",
        title: "Call Quality & Coaching",
        summary: "Monitor queues, IVR, and agent performance to improve live answering.",
        href: `${base}/team-performance/call-quality-coaching`,
        uses: [
          { label: "Queues", href: "/phone/queues" },
          { label: "IVR menus", href: "/phone/ivr" },
          { label: "Voice analytics", href: "/voice/analytics" },
        ],
        cta: { label: "Open queues", href: "/phone/queues" },
      },
    ],
  },
  {
    slug: "custom",
    title: "Custom",
    summary: "Compose your own solution from the underlying platform tools.",
    href: `${base}/custom`,
    solutions: [
      {
        slug: "build",
        title: "Build a Custom Solution",
        summary:
          "Start from automations, AI agents, keywords, or campaigns when a packaged solution isn’t enough.",
        href: `${base}/custom/build`,
        uses: [
          { label: "Automations builder", href: "/automations/new" },
          { label: "AI agents", href: "/voice/agents" },
          { label: "Keywords", href: "/grow/keywords" },
          { label: "Campaigns", href: "/campaigns" },
        ],
        cta: { label: "Open automation builder", href: "/automations/new" },
      },
    ],
  },
];

export function getSolutionCategory(slug: string) {
  return solutionCategories.find((c) => c.slug === slug) || null;
}

export function getSolution(categorySlug: string, solutionSlug: string) {
  const category = getSolutionCategory(categorySlug);
  if (!category) return null;
  const solution = category.solutions.find((s) => s.slug === solutionSlug) || null;
  if (!solution) return null;
  return { category, solution };
}
