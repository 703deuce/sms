/**
 * Outcome-based Solutions registry — permanent product sections with
 * overview, setup, instances, quick settings, and results.
 */

export type OutcomePageKind =
  | "overview"
  | "setup"
  | "active"
  | "settings"
  | "results"
  | "test"
  | "list";

export type OutcomePageDef = {
  slug: string;
  label: string;
  kind: OutcomePageKind;
  /** Optional deep-link into an existing platform page / wizard. */
  launchHref?: string;
  description?: string;
};

export type OutcomeSolutionDef = {
  slug: string;
  title: string;
  summary: string;
  category: "calls-ai" | "sms-messaging" | "customers" | "shared" | "advanced";
  /** What this outcome does (overview body). */
  whatItDoes: string[];
  requiredConnections?: string[];
  setupTime?: string;
  /** Wizard / create entry (may point at existing appointment wizard). */
  setupHref?: string;
  pages: OutcomePageDef[];
  /** Hint for matching VoiceAgent rows when listing instances. */
  agentMatch?: {
    purposes?: string[];
    answerWhen?: string[];
    booking?: boolean;
  };
};

const commonResults: OutcomePageDef = {
  slug: "results",
  label: "Results",
  kind: "results",
  description: "Recent activity and outcomes for this solution.",
};

function pages(...defs: OutcomePageDef[]): OutcomePageDef[] {
  return defs;
}

export const outcomeSolutions: OutcomeSolutionDef[] = [
  {
    slug: "ai-receptionist",
    title: "AI Receptionist",
    summary:
      "Put an AI receptionist on your phones to answer questions, take messages, book appointments, and transfer urgent callers.",
    category: "calls-ai",
    whatItDoes: [
      "Answer every call, missed/overflow calls, or after-hours calls",
      "Capture leads and service intake details",
      "Book, reschedule, or cancel appointments from live calendars",
      "Transfer urgent callers to your team",
    ],
    requiredConnections: ["Phone number", "Business knowledge"],
    setupTime: "10–20 minutes",
    setupHref: "/solutions/ai-call-handling/appointment-assistant/setup",
    agentMatch: { purposes: ["appointment_receptionist"] },
    pages: pages(
      {
        slug: "",
        label: "Overview",
        kind: "overview",
        description: "What AI receptionists can do and which ones you already have.",
      },
      {
        slug: "receptionists",
        label: "Your Receptionists",
        kind: "list",
        description: "All AI receptionists for this workspace.",
      },
    ),
  },
  {
    slug: "answer-every-call",
    title: "AI Answering Service",
    summary:
      "Replace the voicemail box — AI answers every incoming call right away.",
    category: "calls-ai",
    whatItDoes: [
      "Immediate answering on your business number",
      "Answer FAQs from your knowledge base",
      "Take messages and capture caller details",
      "Transfer urgent callers to staff",
      "Optional appointment booking",
    ],
    requiredConnections: ["Phone number", "Business knowledge"],
    setupTime: "10–15 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=every_call",
    agentMatch: {
      purposes: ["appointment_receptionist"],
      answerWhen: ["every_call"],
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=every_call",
      },
      { slug: "active", label: "Active Setups", kind: "active" },
      {
        slug: "call-handling",
        label: "Call Handling",
        kind: "settings",
        description: "Transfers, message taking, and what the AI can do on a call.",
        launchHref: "/voice/inbound-routing",
      },
      {
        slug: "knowledge",
        label: "Business Knowledge",
        kind: "settings",
        description: "FAQs, hours, services, and facts the receptionist can answer.",
        launchHref: "/voice/knowledge",
      },
      {
        slug: "voice",
        label: "Voice & Greeting",
        kind: "settings",
        description: "Voice personality and opening greeting.",
        launchHref: "/voice/agents",
      },
      commonResults,
    ),
  },
  {
    slug: "missed-overflow",
    title: "Cover Missed Calls",
    summary:
      "Your team rings first. AI picks up when nobody answers or the line is busy.",
    category: "calls-ai",
    whatItDoes: [
      "Ring your team first",
      "AI answers on no-answer or busy",
      "Help, book, transfer, or take a message",
      "Optional missed-call SMS follow-up",
    ],
    requiredConnections: ["Phone number", "Staff phones or softphone"],
    setupTime: "15–20 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=nobody_answers",
    agentMatch: {
      purposes: ["appointment_receptionist"],
      answerWhen: ["nobody_answers", "line_busy"],
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=nobody_answers",
      },
      { slug: "active", label: "Active Setups", kind: "active" },
      {
        slug: "ring-rules",
        label: "Ring & Overflow Rules",
        kind: "settings",
        description:
          "Who rings first, ring duration, busy/no-answer behavior, and hours.",
        launchHref: "/voice/inbound-routing",
      },
      {
        slug: "ai-handling",
        label: "AI Call Handling",
        kind: "settings",
        description: "Questions, intake fields, transfers, booking, and lead capture.",
        launchHref: "/voice/agents",
      },
      {
        slug: "follow-up",
        label: "Missed-Call Follow-Up",
        kind: "settings",
        description:
          "SMS when callers hang up early, AI fails to answer, or bookings need confirmation.",
        launchHref: "/automations",
      },
      {
        slug: "notifications",
        label: "Notifications",
        kind: "settings",
        description: "Staff alerts for messages, transfers, and rescued calls.",
        launchHref: "/settings/notifications",
      },
      commonResults,
    ),
  },
  {
    slug: "after-hours",
    title: "Answer After Hours",
    summary:
      "Cover nights, weekends, and holidays — and escalate urgent callers to on-call staff.",
    category: "calls-ai",
    whatItDoes: [
      "After-hours greeting when closed",
      "Message taking for routine callers",
      "Urgent-call identification and on-call transfer",
      "Optional booking outside business hours",
    ],
    requiredConnections: ["Phone number", "Business hours"],
    setupTime: "10–15 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=after_hours",
    agentMatch: {
      purposes: ["appointment_receptionist"],
      answerWhen: ["after_hours", "custom_schedule"],
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=after_hours",
      },
      { slug: "active", label: "Active Setups", kind: "active" },
      {
        slug: "schedule",
        label: "Schedule & Holidays",
        kind: "settings",
        description: "Weekly hours, holidays, temporary closures, and time zone.",
        launchHref: "/settings/messaging",
      },
      {
        slug: "greeting",
        label: "After-Hours Greeting",
        kind: "settings",
        launchHref: "/voice/agents",
      },
      {
        slug: "urgent-routing",
        label: "Urgent Call Routing",
        kind: "settings",
        description: "What counts as urgent, on-call contact, and fallbacks.",
        launchHref: "/voice/inbound-routing",
      },
      {
        slug: "messages",
        label: "Message Handling",
        kind: "settings",
        description: "Routine fields, next-day notifications, and emergency alerts.",
        launchHref: "/inbox",
      },
      commonResults,
    ),
  },
  {
    slug: "appointment-booking",
    title: "Book Appointments",
    summary:
      "Callers can check availability and book, reschedule, or cancel on your live calendar.",
    category: "calls-ai",
    whatItDoes: [
      "Check live calendar availability",
      "Book, reschedule, or cancel appointments",
      "Confirm by voice, SMS, and email",
      "Enforce notice windows, buffers, and eligibility",
    ],
    requiredConnections: ["Calendar", "Phone number"],
    setupTime: "15–25 minutes",
    setupHref: "/solutions/ai-call-handling/appointment-assistant/setup",
    agentMatch: {
      purposes: ["appointment_receptionist"],
      booking: true,
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref: "/solutions/ai-call-handling/appointment-assistant/setup",
      },
      { slug: "active", label: "Active Setups", kind: "active" },
      {
        slug: "calendars",
        label: "Calendars",
        kind: "settings",
        launchHref: "/voice/calendars",
      },
      {
        slug: "appointment-types",
        label: "Appointment Types",
        kind: "settings",
        launchHref: "/voice/calendars",
      },
      {
        slug: "booking-rules",
        label: "Booking Rules",
        kind: "settings",
        launchHref: "/voice/calendars",
      },
      {
        slug: "confirmations",
        label: "Confirmations",
        kind: "settings",
        launchHref: "/templates",
      },
      {
        slug: "test",
        label: "Test Booking",
        kind: "test",
        launchHref: "/voice/testing",
      },
      commonResults,
    ),
  },
  {
    slug: "lead-capture",
    title: "Capture New Leads",
    summary:
      "Collect name, need, timeline, and urgency on the call — then send the lead to your team or CRM.",
    category: "calls-ai",
    whatItDoes: [
      "Collect contact and project details on every call",
      "Score urgency and assign a salesperson",
      "Create leads in CRM or Lead Inbox",
    ],
    requiredConnections: ["Phone number"],
    setupTime: "10–15 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=lead_capture",
    agentMatch: { purposes: ["appointment_receptionist"] },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=lead_capture",
      },
      { slug: "active", label: "Active Setups", kind: "active" },
      {
        slug: "intake",
        label: "Intake Questions",
        kind: "settings",
        launchHref: "/voice/agents",
      },
      {
        slug: "routing",
        label: "Lead Routing",
        kind: "settings",
        launchHref: "/integrations/native/leads",
      },
      {
        slug: "crm",
        label: "CRM Destination",
        kind: "settings",
        launchHref: "/integrations/crm",
      },
      {
        slug: "notifications",
        label: "Notifications",
        kind: "settings",
        launchHref: "/settings/notifications",
      },
      commonResults,
    ),
  },
  {
    slug: "service-intake",
    title: "Take Job Requests",
    summary:
      "For home services and field teams — collect the job type, address, and how urgent it is.",
    category: "calls-ai",
    whatItDoes: [
      "Collect service type, address, and urgency",
      "Respect service areas",
      "Route dispatch to the right team",
    ],
    requiredConnections: ["Phone number"],
    setupTime: "10–15 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=service_intake",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=service_intake",
      },
      { slug: "active", label: "Active Setups", kind: "active" },
      {
        slug: "fields",
        label: "Intake Fields",
        kind: "settings",
        launchHref: "/voice/agents",
      },
      {
        slug: "urgency",
        label: "Urgency Rules",
        kind: "settings",
        launchHref: "/voice/inbound-routing",
      },
      {
        slug: "dispatch",
        label: "Dispatch Routing",
        kind: "settings",
        launchHref: "/integrations/native/tasks",
      },
      commonResults,
    ),
  },
  {
    slug: "missed-call-text-back",
    title: "Text Back Missed Callers",
    summary: "Automatically text people who called and could not reach you.",
    category: "sms-messaging",
    whatItDoes: [
      "Detect missed, busy, and early hang-up calls",
      "Send a personalized text after a short delay",
      "Continue with AI, inbox, or booking when they reply",
    ],
    requiredConnections: ["Phone number", "Messaging number"],
    setupTime: "5–10 minutes",
    setupHref: "/automations/new",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref: "/automations/new",
      },
      { slug: "active", label: "Active Workflows", kind: "active" },
      {
        slug: "triggers",
        label: "Trigger Rules",
        kind: "settings",
        launchHref: "/voice/inbound-routing",
      },
      {
        slug: "messages",
        label: "Messages",
        kind: "settings",
        launchHref: "/templates",
      },
      {
        slug: "replies",
        label: "Reply Handling",
        kind: "settings",
        launchHref: "/inbox",
      },
      {
        slug: "ai-responses",
        label: "AI Responses",
        kind: "settings",
        launchHref: "/send/ai",
      },
      commonResults,
    ),
  },
  {
    slug: "instant-lead-response",
    title: "Text New Leads Instantly",
    summary:
      "When a new lead comes in, text or call them right away — or let them choose.",
    category: "sms-messaging",
    whatItDoes: [
      "Watch forms, keywords, and CRM lead sources",
      "Text first, call first, or let the lead choose",
      "Qualify and escalate to a human when needed",
    ],
    requiredConnections: ["Lead source", "Messaging number"],
    setupTime: "10–15 minutes",
    setupHref: "/automations/new",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref: "/automations/new",
      },
      { slug: "active", label: "Active Workflows", kind: "active" },
      {
        slug: "sources",
        label: "Lead Sources",
        kind: "settings",
        launchHref: "/grow/sources",
      },
      {
        slug: "strategy",
        label: "Response Strategy",
        kind: "settings",
        description:
          "Text first, call first, text-then-call, call-then-text, or let the lead choose.",
      },
      {
        slug: "messages",
        label: "Messages",
        kind: "settings",
        launchHref: "/templates",
      },
      {
        slug: "escalation",
        label: "Call Escalation",
        kind: "settings",
        launchHref: "/voice/campaigns",
      },
      {
        slug: "qualification",
        label: "Qualification",
        kind: "settings",
        launchHref: "/integrations/native/leads",
      },
      commonResults,
    ),
  },
  {
    slug: "old-lead-reactivation",
    title: "Re-engage Old Leads",
    summary: "Win back quiet contacts with targeted text campaigns.",
    category: "sms-messaging",
    whatItDoes: [
      "Build an audience from dormant leads",
      "Schedule multi-touch message sequences",
      "Route replies into Inbox",
    ],
    requiredConnections: ["Contacts / segments"],
    setupTime: "10 minutes",
    setupHref: "/campaigns",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "create",
        label: "Create Campaign",
        kind: "setup",
        launchHref: "/send",
      },
      { slug: "active", label: "Active Campaigns", kind: "active" },
      {
        slug: "audience",
        label: "Audience",
        kind: "settings",
        launchHref: "/contacts/segments",
      },
      {
        slug: "messages",
        label: "Messages",
        kind: "settings",
        launchHref: "/templates",
      },
      {
        slug: "schedule",
        label: "Schedule",
        kind: "settings",
        launchHref: "/campaigns/scheduled",
      },
      {
        slug: "replies",
        label: "Replies",
        kind: "settings",
        launchHref: "/inbox",
      },
      commonResults,
    ),
  },
  {
    slug: "review-requests",
    title: "Ask for Reviews",
    summary: "Text happy customers a review link at the right moment.",
    category: "sms-messaging",
    whatItDoes: [
      "Trigger after jobs, calls, or appointments",
      "Send review links with reminders",
      "Stop after a review is left",
    ],
    requiredConnections: ["Review link", "Messaging number"],
    setupTime: "5–10 minutes",
    setupHref: "/automations/new",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref: "/automations/new",
      },
      { slug: "active", label: "Active Workflows", kind: "active" },
      {
        slug: "links",
        label: "Review Links",
        kind: "settings",
        launchHref: "/settings/business",
      },
      {
        slug: "trigger",
        label: "Trigger",
        kind: "settings",
        launchHref: "/automations",
      },
      {
        slug: "messages",
        label: "Messages",
        kind: "settings",
        launchHref: "/templates",
      },
      {
        slug: "reminders",
        label: "Reminders",
        kind: "settings",
        launchHref: "/automations",
      },
      commonResults,
    ),
  },
  {
    slug: "appointment-reminders",
    title: "Remind About Appointments",
    summary:
      "Text appointment reminders; only use AI voice if someone still hasn’t confirmed.",
    category: "sms-messaging",
    whatItDoes: [
      "Pull upcoming appointments from connected calendars",
      "Send timed reminders with confirm / reschedule links",
      "Escalate unconfirmed appointments with an AI voice call",
    ],
    requiredConnections: ["Calendar"],
    setupTime: "10 minutes",
    setupHref: "/automations/new",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref: "/automations/new",
      },
      { slug: "active", label: "Active Workflows", kind: "active" },
      {
        slug: "calendar",
        label: "Calendar",
        kind: "settings",
        launchHref: "/voice/calendars",
      },
      {
        slug: "schedule",
        label: "Reminder Schedule",
        kind: "settings",
        launchHref: "/automations",
      },
      {
        slug: "confirm",
        label: "Confirm & Reschedule",
        kind: "settings",
        launchHref: "/integrations/native/appointments",
      },
      {
        slug: "voice-escalation",
        label: "Voice Escalation",
        kind: "settings",
        launchHref: "/voice/campaigns",
      },
      commonResults,
    ),
  },
  {
    slug: "estimate-follow-up",
    title: "Follow Up on Estimates",
    summary: "Nudge customers after you send an estimate until they book or decline.",
    category: "sms-messaging",
    whatItDoes: [
      "Watch estimate sources and CRM stages",
      "Run a polite follow-up sequence",
      "Offer booking when the customer is ready",
    ],
    requiredConnections: ["CRM or estimate source"],
    setupTime: "10 minutes",
    setupHref: "/automations/new",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        launchHref: "/automations/new",
      },
      { slug: "active", label: "Active Workflows", kind: "active" },
      {
        slug: "source",
        label: "Estimate Source",
        kind: "settings",
        launchHref: "/integrations/crm",
      },
      {
        slug: "sequence",
        label: "Follow-Up Sequence",
        kind: "settings",
        launchHref: "/automations",
      },
      {
        slug: "replies",
        label: "Replies",
        kind: "settings",
        launchHref: "/inbox",
      },
      {
        slug: "booking",
        label: "Booking",
        kind: "settings",
        launchHref: "/outcomes/appointment-booking",
      },
      commonResults,
    ),
  },
  {
    slug: "promotional-broadcast",
    title: "Send a Promo Text",
    summary: "Send offers and announcements to the right audience at the right time.",
    category: "sms-messaging",
    whatItDoes: [
      "Build audiences from lists and segments",
      "Draft and schedule promotional SMS",
      "Track delivery and replies",
    ],
    requiredConnections: ["Messaging number", "Audience"],
    setupTime: "5–10 minutes",
    setupHref: "/send",
    pages: pages(
      { slug: "", label: "Overview", kind: "overview" },
      {
        slug: "create",
        label: "Create Broadcast",
        kind: "setup",
        launchHref: "/send",
      },
      {
        slug: "drafts",
        label: "Drafts",
        kind: "list",
        launchHref: "/campaigns/drafts",
      },
      {
        slug: "audiences",
        label: "Audiences",
        kind: "settings",
        launchHref: "/contacts/lists",
      },
      {
        slug: "templates",
        label: "Templates",
        kind: "settings",
        launchHref: "/templates",
      },
      {
        slug: "scheduled",
        label: "Scheduled",
        kind: "list",
        launchHref: "/campaigns/scheduled",
      },
      commonResults,
    ),
  },
];

export function getOutcomeSolution(slug: string): OutcomeSolutionDef | undefined {
  return outcomeSolutions.find((s) => s.slug === slug);
}

export function getOutcomePage(
  solution: OutcomeSolutionDef,
  section: string | undefined,
): OutcomePageDef | undefined {
  const key = section || "";
  return solution.pages.find((p) => p.slug === key);
}

export function outcomeHref(solutionSlug: string, pageSlug = ""): string {
  if (!pageSlug) return `/outcomes/${solutionSlug}`;
  return `/outcomes/${solutionSlug}/${pageSlug}`;
}
