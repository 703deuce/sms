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
  /** Concrete settings / metrics listed on the page shell. */
  bullets?: string[];
  /**
   * How this page appears in the Solutions sidebar:
   * - core: Overview / Set Up (always relevant)
   * - list: “Your setups” inventory page
   * - manage: post-setup management shortcut
   */
  navRole?: "core" | "list" | "manage";
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
  /** Page slugs nested under a single instance in the sidebar. */
  instanceShortcutSlugs?: string[];
  /** Label for the inventory page when many setups exist. */
  setupsListLabel?: string;
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
      "Answers every incoming call immediately",
      "Answers business questions from your information",
      "Takes messages and captures leads",
      "Transfers callers when needed",
      "Optional appointment booking",
    ],
    requiredConnections: ["Phone number", "Business knowledge"],
    setupTime: "10–15 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=every_call",
    setupsListLabel: "Your Answering Services",
    instanceShortcutSlugs: [
      "answering-rules",
      "business-info",
      "call-handling",
      "voice",
      "transfers-messages",
      "notifications",
      "test",
      "results",
    ],
    agentMatch: {
      purposes: ["appointment_receptionist"],
      answerWhen: ["every_call"],
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview", navRole: "core" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        navRole: "core",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=every_call",
      },
      {
        slug: "active",
        label: "Your Answering Services",
        kind: "active",
        navRole: "list",
        description: "All AI answering services for this workspace.",
      },
      {
        slug: "answering-rules",
        label: "Answering Rules",
        kind: "settings",
        navRole: "manage",
        description: "When and where this service answers.",
        launchHref: "/voice/inbound-routing",
        bullets: [
          "Answer every incoming call",
          "Selected phone numbers",
          "Business-hours schedule",
          "Closed-hours behavior",
          "Holiday behavior",
          "Blocked callers",
          "Spam handling",
          "Maximum call duration",
          "Failed-agent fallback",
        ],
      },
      {
        slug: "business-info",
        label: "Business Information",
        kind: "settings",
        navRole: "manage",
        description: "Facts the answering service uses on every call.",
        launchHref: "/voice/knowledge",
        bullets: [
          "Business name",
          "Address",
          "Hours",
          "Services",
          "Pricing",
          "Service area",
          "Policies",
          "FAQs",
          "Website import",
          "Uploaded documents",
          "Knowledge-base status",
        ],
      },
      {
        slug: "call-handling",
        label: "Call Handling",
        kind: "settings",
        navRole: "manage",
        description: "What the agent is allowed to do on a call.",
        launchHref: "/voice/agents",
        bullets: [
          "Answer questions",
          "Capture caller information",
          "Take messages",
          "Identify urgency",
          "Capture leads",
          "Book appointments",
          "Reschedule or cancel",
          "Create support requests",
          "End spam calls",
          "Handle unsupported requests",
        ],
      },
      {
        slug: "voice",
        label: "Voice & Greeting",
        kind: "settings",
        navRole: "manage",
        description: "How the receptionist sounds and greets callers.",
        launchHref: "/voice/agents",
        bullets: [
          "Agent name",
          "Voice",
          "Speaking speed",
          "Opening greeting",
          "Connection greeting",
          "Language",
          "Tone",
          "Responsiveness",
          "Interruption sensitivity",
          "Pronunciation dictionary",
        ],
      },
      {
        slug: "transfers-messages",
        label: "Transfers & Messages",
        kind: "settings",
        navRole: "manage",
        description:
          "Where callers go when AI needs a person — and how messages are saved.",
        launchHref: "/voice/agents",
        bullets: [
          "Transfer destinations",
          "Transfer reasons",
          "Ring duration",
          "Warm or direct transfer",
          "Failed-transfer behavior",
          "Message fields",
          "Message recipients",
          "Urgent-call handling",
          "Voicemail detection",
        ],
      },
      {
        slug: "notifications",
        label: "Notifications",
        kind: "settings",
        navRole: "manage",
        description: "Who gets alerted for messages, transfers, and new leads.",
        launchHref: "/settings/notifications",
        bullets: [
          "Notify on every message",
          "Notify on urgent calls",
          "Notify on failed transfers",
          "Notify on new leads",
          "Email recipient",
          "SMS recipient",
          "Dashboard notifications",
          "CRM task creation",
        ],
      },
      {
        slug: "test",
        label: "Test",
        kind: "test",
        navRole: "manage",
        description: "Rehearse FAQ, messages, transfers, spam, and early hang-ups.",
        launchHref: "/voice/testing",
        bullets: [
          "FAQ question",
          "Message taking",
          "Human transfer",
          "Failed transfer",
          "Urgent call",
          "Spam caller",
          "Knowledge unavailable",
          "Caller hangs up early",
        ],
      },
      {
        slug: "results",
        label: "Calls & Results",
        kind: "results",
        navRole: "manage",
        description: "Calls answered, messages, transfers, leads, and recordings.",
        launchHref: "/voice/calls",
        bullets: [
          "Calls answered",
          "Messages taken",
          "Transfers attempted",
          "Successful transfers",
          "Leads captured",
          "Average call duration",
          "Resolution rate",
          "Recordings",
          "Transcripts",
          "Summaries",
          "Recent errors",
        ],
      },
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
      "Optional missed-call text follow-up",
    ],
    requiredConnections: ["Phone number", "Staff phones or softphone"],
    setupTime: "15–20 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=nobody_answers",
    setupsListLabel: "Your Setups",
    instanceShortcutSlugs: [
      "ring-rules",
      "ai-handling",
      "follow-up",
      "transfers-messages",
      "notifications",
      "test",
      "results",
    ],
    agentMatch: {
      purposes: ["appointment_receptionist"],
      answerWhen: ["nobody_answers", "line_busy"],
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview", navRole: "core" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        navRole: "core",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=nobody_answers",
      },
      {
        slug: "active",
        label: "Your Setups",
        kind: "active",
        navRole: "list",
      },
      {
        slug: "ring-rules",
        label: "Ring & Overflow Rules",
        kind: "settings",
        navRole: "manage",
        description: "Who rings first, how long, and when AI steps in.",
        launchHref: "/voice/inbound-routing",
        bullets: [
          "Which number receives the original call",
          "Which employees or devices ring first",
          "Simultaneous or sequential ringing",
          "Ring duration",
          "Answer on busy",
          "Answer on no response",
          "Answer on rejected call",
          "Answer when all agents are unavailable",
          "Open-hours / closed-hours / weekend / holiday behavior",
          "Fallback if AI cannot start",
        ],
      },
      {
        slug: "ai-handling",
        label: "AI Call Handling",
        kind: "settings",
        navRole: "manage",
        description: "What AI does after it takes over a missed or busy call.",
        launchHref: "/voice/agents",
        bullets: [
          "Questions it can answer",
          "What information it collects",
          "Message-taking fields",
          "Lead capture",
          "Appointment booking",
          "Call transfers",
          "Urgent-call behavior",
          "Existing customer handling",
          "Spam handling",
        ],
      },
      {
        slug: "follow-up",
        label: "Caller Follow-Up",
        kind: "settings",
        navRole: "manage",
        description:
          "When to text back — and when not to, after a real AI conversation.",
        launchHref: "/automations",
        bullets: [
          "Caller hangs up before AI begins",
          "Caller disconnects before meaningful engagement",
          "AI fails to answer",
          "Transfer fails",
          "Message is incomplete",
          "Never send after a successful conversation",
          "SMS / email / AI callback / staff task",
          "Business-hours and after-hours message versions",
          "AI handles replies or assign to inbox",
        ],
      },
      {
        slug: "transfers-messages",
        label: "Transfers & Messages",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/agents",
        bullets: [
          "Transfer destination",
          "Ring time",
          "Failed-transfer fallback",
          "Message recipients",
          "Required message fields",
          "Urgency labels",
          "Callback expectations",
        ],
      },
      {
        slug: "notifications",
        label: "Notifications",
        kind: "settings",
        navRole: "manage",
        launchHref: "/settings/notifications",
        bullets: [
          "Missed call rescued",
          "Caller hung up before engaging",
          "Message taken",
          "New lead captured",
          "Transfer failed",
          "Appointment booked",
          "Recovery text reply",
          "High-priority caller",
        ],
      },
      {
        slug: "test",
        label: "Test",
        kind: "test",
        navRole: "manage",
        launchHref: "/voice/testing",
        bullets: [
          "Staff does not answer",
          "Staff line is busy",
          "Caller waits and talks to AI",
          "Caller hangs up before AI speaks",
          "Follow-up SMS fires or is suppressed correctly",
        ],
      },
      {
        slug: "results",
        label: "Calls & Results",
        kind: "results",
        navRole: "manage",
        description: "Emphasizes recovered calls — not just total volume.",
        launchHref: "/voice/analytics",
        bullets: [
          "Calls staff answered",
          "Calls routed to AI",
          "Calls rescued",
          "Callers who engaged with AI",
          "Early hang-ups",
          "Messages captured",
          "Appointments booked",
          "Follow-up texts sent",
          "Replies received",
        ],
      },
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
      "Handles questions and routine requests",
      "Routes urgent calls to on-call staff",
      "Saves messages for the next business day",
    ],
    requiredConnections: ["Phone number", "Business hours"],
    setupTime: "10–15 minutes",
    setupHref:
      "/solutions/ai-call-handling/appointment-assistant/setup?preset=after_hours",
    setupsListLabel: "Your Setups",
    instanceShortcutSlugs: [
      "hours",
      "greeting",
      "after-hours-handling",
      "urgent-routing",
      "messages-next",
      "notifications",
      "test",
      "results",
    ],
    agentMatch: {
      purposes: ["appointment_receptionist"],
      answerWhen: ["after_hours", "custom_schedule"],
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview", navRole: "core" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        navRole: "core",
        launchHref:
          "/solutions/ai-call-handling/appointment-assistant/setup?preset=after_hours",
      },
      {
        slug: "active",
        label: "Your Setups",
        kind: "active",
        navRole: "list",
      },
      {
        slug: "hours",
        label: "Hours & Holidays",
        kind: "settings",
        navRole: "manage",
        description: "Update hours without reopening the wizard.",
        launchHref: "/settings/messaging",
        bullets: [
          "Weekly business hours",
          "Time zone",
          "Weekend schedule",
          "Holiday calendar",
          "Temporary closures",
          "Special event hours",
          "Vacation closure",
          "Early closing",
          "Manual “closed now” override",
          "Automatic reactivation time",
        ],
      },
      {
        slug: "greeting",
        label: "After-Hours Greeting",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/agents",
        bullets: [
          "Standard after-hours greeting",
          "Holiday greeting",
          "Temporary-closure greeting",
          "Emergency-service greeting",
          "Agent name",
          "Voice",
          "Connection audio",
          "Custom uploaded greeting",
        ],
      },
      {
        slug: "after-hours-handling",
        label: "After-Hours Call Handling",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/agents",
        bullets: [
          "Answer business questions",
          "Book future appointments",
          "Take routine messages",
          "Identify urgent issues",
          "Handle existing customers",
          "Give emergency instructions",
          "Collect service address",
          "Collect preferred callback time",
          "Explain reopening time",
          "Create a service request",
        ],
      },
      {
        slug: "urgent-routing",
        label: "Urgent Call Routing",
        kind: "settings",
        navRole: "manage",
        description: "On-call contacts, backups, and failed-transfer fallbacks.",
        launchHref: "/voice/inbound-routing",
        bullets: [
          "What counts as urgent",
          "Keywords or conditions",
          "Emergency disclaimer",
          "On-call contact",
          "Backup on-call contact",
          "Different contact by day",
          "Ring duration",
          "Warm or direct transfer",
          "Voicemail behavior",
          "Failed-transfer fallback",
          "Maximum number of attempts",
          "Staff escalation method",
        ],
      },
      {
        slug: "messages-next",
        label: "Messages & Next Steps",
        kind: "settings",
        navRole: "manage",
        launchHref: "/inbox",
        bullets: [
          "Routine message fields",
          "Urgent message fields",
          "Send acknowledgment to caller",
          "Next-business-day follow-up task",
          "Expected callback wording",
          "Message recipient",
          "Department assignment",
          "Appointment booking",
          "Service-request creation",
        ],
      },
      {
        slug: "notifications",
        label: "Notifications",
        kind: "settings",
        navRole: "manage",
        launchHref: "/settings/notifications",
        bullets: [
          "Every after-hours message",
          "Urgent call detected",
          "Successful / failed urgent transfer",
          "Appointment booked",
          "Caller requested next-day callback",
          "Service request created",
          "Morning digest summary",
        ],
      },
      {
        slug: "test",
        label: "Test",
        kind: "test",
        navRole: "manage",
        launchHref: "/voice/testing",
        bullets: [
          "Routine question after hours",
          "Appointment request",
          "Urgent issue",
          "Primary on-call answers",
          "Primary fails and backup answers",
          "Both transfers fail",
          "Holiday / temporary closure",
        ],
      },
      {
        slug: "results",
        label: "Calls & Results",
        kind: "results",
        navRole: "manage",
        launchHref: "/voice/analytics",
        bullets: [
          "After-hours calls answered",
          "Routine calls resolved",
          "Messages taken",
          "Urgent calls detected",
          "Successful / failed on-call transfers",
          "Appointments booked",
          "Next-day callbacks requested",
          "Recordings, transcripts, and summaries",
        ],
      },
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
    setupsListLabel: "Your Booking Setups",
    instanceShortcutSlugs: [
      "calendars",
      "appointment-types",
      "booking-rules",
      "caller-info",
      "confirmations",
      "reschedule",
      "voice-handling",
      "test",
      "results",
    ],
    agentMatch: {
      purposes: ["appointment_receptionist"],
      booking: true,
    },
    pages: pages(
      { slug: "", label: "Overview", kind: "overview", navRole: "core" },
      {
        slug: "setup",
        label: "Set Up",
        kind: "setup",
        navRole: "core",
        launchHref: "/solutions/ai-call-handling/appointment-assistant/setup",
      },
      {
        slug: "active",
        label: "Your Booking Setups",
        kind: "active",
        navRole: "list",
      },
      {
        slug: "calendars",
        label: "Calendars",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/calendars",
        bullets: [
          "Calendar connections",
          "Staff calendars",
          "Reconnect",
          "Calendar ownership",
          "Availability sources",
          "Conflict handling",
        ],
      },
      {
        slug: "appointment-types",
        label: "Appointment Types",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/calendars",
        bullets: [
          "Name",
          "Duration",
          "Location",
          "Calendar",
          "Assigned staff",
          "Description",
          "Required fields",
          "Booking permissions",
        ],
      },
      {
        slug: "booking-rules",
        label: "Booking Rules",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/calendars",
        bullets: [
          "Booking hours",
          "Minimum notice",
          "Maximum days ahead",
          "Buffers",
          "Earliest slots",
          "Number of options offered",
          "Staff selection",
          "Service eligibility",
          "Direct booking or request-only",
        ],
      },
      {
        slug: "caller-info",
        label: "Caller Information",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/agents",
        bullets: [
          "Name",
          "Phone",
          "Email",
          "Address",
          "Service requested",
          "New or existing customer",
          "Intake questions",
          "Required versus optional",
        ],
      },
      {
        slug: "confirmations",
        label: "Confirmations & Reminders",
        kind: "settings",
        navRole: "manage",
        launchHref: "/templates",
        bullets: [
          "Spoken confirmation",
          "SMS",
          "Email",
          "Directions",
          "Intake form",
          "Reminder sequence",
          "Confirmation requirement",
        ],
      },
      {
        slug: "reschedule",
        label: "Reschedule & Cancellation",
        kind: "settings",
        navRole: "manage",
        launchHref: "/integrations/native/appointments",
        bullets: [
          "Allow rescheduling",
          "Allow cancellation",
          "Minimum notice",
          "Cancellation policy",
          "Alternative times",
          "Staff notification",
          "Calendar update",
        ],
      },
      {
        slug: "voice-handling",
        label: "Voice & Call Handling",
        kind: "settings",
        navRole: "manage",
        launchHref: "/voice/agents",
        bullets: [
          "Greeting",
          "Voice",
          "Booking conversation",
          "Transfer fallback",
          "What happens when no slots exist",
          "Calendar-error response",
        ],
      },
      {
        slug: "test",
        label: "Test Booking",
        kind: "test",
        navRole: "manage",
        launchHref: "/voice/testing",
        bullets: [
          "Real calendar test",
          "No-availability test",
          "Ambiguous date test",
          "Tool-failure test",
          "Duplicate-booking test",
          "Reschedule test",
          "Cancellation test",
        ],
      },
      {
        slug: "results",
        label: "Appointments & Results",
        kind: "results",
        navRole: "manage",
        launchHref: "/integrations/native/appointments",
        bullets: [
          "Availability checks",
          "Bookings",
          "Reschedules",
          "Cancellations",
          "No availability",
          "Booking failures",
          "Appointment conversion",
          "Revenue estimate when available",
        ],
      },
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
