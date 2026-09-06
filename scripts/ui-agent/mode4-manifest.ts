/**
 * Approved Mode 4 rebuild manifest — allowlist only.
 * @see docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config";
import { buildProjectManifest } from "./project-context";

export type Mode4Archetype =
  | "Dashboard"
  | "List"
  | "Calendar"
  | "Detail"
  | "Configuration"
  | "Builder"
  | "Public"
  | "Foundation";

export type Mode4Stage = "foundations" | "golden" | "bulk";

export type Mode4ArtDirection = "campaign" | "inbox" | "workflows" | "golden";

export type Mode4ManifestEntry = {
  id: string;
  route: string;
  canonicalPath: string;
  archetype: Mode4Archetype;
  stage: Mode4Stage;
  golden?: boolean;
  artDirection: Mode4ArtDirection;
  primaryFiles: string[];
  sharedConsume: string[];
  sharedForbidden: string[];
  v1Section?: string;
  notes?: string;
};

export type Mode4RebuildManifest = {
  version: number;
  updatedAt: string;
  maxConcurrentJobs: number;
  staggerMs: number;
  entries: Mode4ManifestEntry[];
};

const MANIFEST_PATH = join(REPO_ROOT, ".ui-agent/mode4/rebuild-manifest.json");

const SHARED_FORBIDDEN = [
  "src/components/layout/sidebar.tsx",
  "src/components/layout/header.tsx",
  "src/components/ui/",
  "src/app/globals.css",
  "src/app/(app)/product-theme.css",
];

const SHARED_CONSUME = [
  "src/components/layout/",
  "src/components/ui/",
  "src/styles/",
];

function routePrimaryFiles(route: string): string[] {
  try {
    const manifest = buildProjectManifest(route);
    return manifest.targetFiles;
  } catch {
    return [];
  }
}

/** Inline manifest — single source for batch runner. MD doc mirrors this list. */
export const MODE4_REBUILD_ENTRIES: Mode4ManifestEntry[] = [
  // Stage D — Foundations (serial)
  {
    id: "foundation-shell",
    route: "__foundation__",
    canonicalPath: "Platform → Shared Shell",
    archetype: "Foundation",
    stage: "foundations",
    artDirection: "campaign",
    primaryFiles: [
      "src/components/layout/sidebar.tsx",
      "src/components/layout/header.tsx",
      "src/app/(app)/layout.tsx",
      "src/app/globals.css",
      "src/app/(app)/product-theme.css",
    ],
    sharedConsume: [],
    sharedForbidden: [],
    notes: "Establish canonical sidebar, header, tokens once. Serial only.",
  },

  // Stage E — Golden screens
  {
    id: "home",
    route: "/appointments/overview",
    canonicalPath: "Home",
    archetype: "Dashboard",
    stage: "golden",
    golden: true,
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/appointments/overview"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§6 Overview",
  },
  {
    id: "appointments-calendar",
    route: "/appointments/calendar",
    canonicalPath: "Appointments → Calendar",
    archetype: "Calendar",
    stage: "golden",
    golden: true,
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/appointments/calendar"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§7 Calendar",
  },
  {
    id: "appointments-list",
    route: "/appointments",
    canonicalPath: "Appointments → List",
    archetype: "List",
    stage: "golden",
    golden: true,
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/appointments"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§8 Appointments list",
  },
  {
    id: "appointment-detail",
    route: "/appointments/[id]",
    canonicalPath: "Appointments → Appointment Detail",
    archetype: "Detail",
    stage: "golden",
    golden: true,
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/appointments/[id]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§11 Appointment detail",
    notes: "Use capture-path for a real appointment id when integrating.",
  },
  {
    id: "booking-types",
    route: "/appointments/types",
    canonicalPath: "Booking → Booking Types",
    archetype: "Configuration",
    stage: "golden",
    golden: true,
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/appointments/types"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§9 Appointment Types",
  },
  {
    id: "workflow-builder",
    route: "/appointments/workflows",
    canonicalPath: "Automations → Workflows",
    archetype: "Builder",
    stage: "golden",
    golden: true,
    artDirection: "workflows",
    primaryFiles: routePrimaryFiles("/appointments/workflows"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    notes: "Include builder canvas, node config modals, list view.",
  },

  // Stage G — Bulk (concurrent)
  {
    id: "appointments-waitlist",
    route: "/appointments/waitlist",
    canonicalPath: "Appointments → Waitlist",
    archetype: "List",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/waitlist"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "appointments-recalls",
    route: "/appointments/recalls",
    canonicalPath: "Appointments → Recalls",
    archetype: "List",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/recalls"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "appointments-recall-campaigns",
    route: "/appointments/recall-campaigns",
    canonicalPath: "Appointments → Recall Campaigns",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/recall-campaigns"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    notes: "Reachable from Recalls hub",
  },
  {
    id: "appointments-no-show-recovery",
    route: "/appointments/no-show-recovery",
    canonicalPath: "Appointments → No-Show Recovery",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/no-show-recovery"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    notes: "Reachable from Recalls hub",
  },
  {
    id: "appointments-new",
    route: "/appointments/new",
    canonicalPath: "Appointments → New Appointment",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/new"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§10 Create / edit appointment",
  },
  {
    id: "appointments-setup",
    route: "/appointments/setup",
    canonicalPath: "Appointments → Get Started",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/setup"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§28 First-run onboarding",
  },
  {
    id: "booking-pages",
    route: "/appointments/booking",
    canonicalPath: "Booking → Booking Pages",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/booking"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§12 Booking page management",
  },
  {
    id: "availability",
    route: "/appointments/availability",
    canonicalPath: "Booking → Availability",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/availability"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "ai-booking",
    route: "/appointments/ai-booking",
    canonicalPath: "Booking → AI Booking",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/ai-booking"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "routing-forms",
    route: "/appointments/routing-forms",
    canonicalPath: "Booking → Routing",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/routing-forms"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "meeting-polls",
    route: "/appointments/polls",
    canonicalPath: "Booking → Meeting Polls",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/polls"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "team-pages",
    route: "/appointments/team-pages",
    canonicalPath: "Booking → Team Booking Pages",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/team-pages"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "reminder-sequences",
    route: "/appointments/reminders",
    canonicalPath: "Automations → Reminder Sequences",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/reminders"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§14 Reminder settings",
  },
  {
    id: "workflow-new",
    route: "/appointments/workflows/new",
    canonicalPath: "Automations → New Workflow",
    archetype: "Builder",
    stage: "bulk",
    artDirection: "workflows",
    primaryFiles: routePrimaryFiles("/appointments/workflows/new"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "workflow-edit",
    route: "/appointments/workflows/[id]/edit",
    canonicalPath: "Automations → Edit Workflow",
    archetype: "Builder",
    stage: "bulk",
    artDirection: "workflows",
    primaryFiles: routePrimaryFiles("/appointments/workflows/[id]/edit"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "workflow-setup",
    route: "/appointments/workflows/setup/[templateId]",
    canonicalPath: "Automations → Workflow Setup Wizard",
    archetype: "Builder",
    stage: "bulk",
    artDirection: "workflows",
    primaryFiles: routePrimaryFiles("/appointments/workflows/setup/[templateId]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "automation-templates",
    route: "/appointments/automations/templates",
    canonicalPath: "Automations → Templates",
    archetype: "List",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/automations/templates"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "automation-activity",
    route: "/appointments/automations/activity",
    canonicalPath: "Automations → Activity",
    archetype: "List",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/automations/activity"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "contacts",
    route: "/contacts",
    canonicalPath: "Contacts",
    archetype: "List",
    stage: "bulk",
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/contacts"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§17 Contacts",
  },
  {
    id: "contact-detail",
    route: "/contacts/[id]",
    canonicalPath: "Contacts → Detail",
    archetype: "Detail",
    stage: "bulk",
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/contacts/[id]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "contacts-lists",
    route: "/contacts/lists",
    canonicalPath: "Contacts → Lists",
    archetype: "List",
    stage: "bulk",
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/contacts/lists"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "contacts-segments",
    route: "/contacts/segments",
    canonicalPath: "Contacts → Segments",
    archetype: "List",
    stage: "bulk",
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/contacts/segments"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "contacts-fields",
    route: "/contacts/fields",
    canonicalPath: "Contacts → Custom Fields",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/contacts/fields"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "contacts-imports",
    route: "/contacts/imports",
    canonicalPath: "Contacts → Imports",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "campaign",
    primaryFiles: routePrimaryFiles("/contacts/imports"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "messages-inbox",
    route: "/conversations",
    canonicalPath: "Messages → Inbox",
    archetype: "List",
    stage: "bulk",
    artDirection: "inbox",
    primaryFiles: routePrimaryFiles("/conversations"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§16 Conversations",
  },
  {
    id: "messages-saved-replies",
    route: "/conversations/saved-replies",
    canonicalPath: "Messages → Saved Replies",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "inbox",
    primaryFiles: routePrimaryFiles("/conversations/saved-replies"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "meetings-upcoming",
    route: "/video",
    canonicalPath: "Meetings → Upcoming",
    archetype: "List",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/video"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "meetings-recaps",
    route: "/meetings",
    canonicalPath: "Meetings → Recaps",
    archetype: "List",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/meetings"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "meeting-detail",
    route: "/meetings/[id]",
    canonicalPath: "Meetings → Recap Detail",
    archetype: "Detail",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/meetings/[id]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "payments-transactions",
    route: "/payments/transactions",
    canonicalPath: "Payments → Transactions",
    archetype: "List",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/payments/transactions"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "analytics-overview",
    route: "/appointments/analytics",
    canonicalPath: "Analytics → Overview",
    archetype: "Dashboard",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/analytics"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§21 Analytics",
  },
  {
    id: "analytics-booking",
    route: "/appointments/analytics/booking",
    canonicalPath: "Analytics → Booking",
    archetype: "Dashboard",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/analytics/booking"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "analytics-reminders",
    route: "/appointments/analytics/reminders",
    canonicalPath: "Analytics → Reminders",
    archetype: "Dashboard",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/analytics/reminders"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "analytics-automations",
    route: "/appointments/analytics/automations",
    canonicalPath: "Analytics → Automations",
    archetype: "Dashboard",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/analytics/automations"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "analytics-reports",
    route: "/appointments/analytics/reports",
    canonicalPath: "Analytics → Reports",
    archetype: "Dashboard",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/analytics/reports"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "integrations-calendars",
    route: "/integrations/calendars",
    canonicalPath: "Integrations → Calendars",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/integrations/calendars"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§23 Integrations",
  },
  {
    id: "integrations-payments",
    route: "/integrations/payments",
    canonicalPath: "Integrations → Payments",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/integrations/payments"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "settings-business",
    route: "/settings/business",
    canonicalPath: "Settings → Business",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/settings/business"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§22 Settings",
  },
  {
    id: "settings-users",
    route: "/settings/users",
    canonicalPath: "Settings → Team",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/settings/users"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "settings-messaging",
    route: "/settings/messaging",
    canonicalPath: "Settings → Messaging",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/settings/messaging"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "settings-calendar",
    route: "/settings/calendar",
    canonicalPath: "Settings → Calendar",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/settings/calendar"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "settings-meetings",
    route: "/settings/ai-notetaker",
    canonicalPath: "Settings → Meetings",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/settings/ai-notetaker"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "settings-security",
    route: "/settings/security",
    canonicalPath: "Settings → Security",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/settings/security"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "settings-billing",
    route: "/settings/billing",
    canonicalPath: "Settings → Billing",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/settings/billing"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "help-getting-started",
    route: "/getting-started",
    canonicalPath: "Help → Getting Started",
    archetype: "Configuration",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/getting-started"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  // Public customer-facing booking surfaces
  {
    id: "public-booking",
    route: "/book/[slug]",
    canonicalPath: "Public → Booking Page",
    archetype: "Public",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/book/[slug]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§13 Public booking",
  },
  {
    id: "public-booking-service",
    route: "/book/[slug]/[serviceId]",
    canonicalPath: "Public → Booking Service Select",
    archetype: "Public",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/book/[slug]/[serviceId]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "public-embed-booking",
    route: "/embed/book/[slug]",
    canonicalPath: "Public → Embed Booking",
    archetype: "Public",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/embed/book/[slug]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "public-confirm",
    route: "/appointments/confirm/[token]",
    canonicalPath: "Public → Confirm Appointment",
    archetype: "Public",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/confirm/[token]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
    v1Section: "§15 Confirm / cancel / reschedule",
  },
  {
    id: "public-cancel",
    route: "/appointments/cancel/[token]",
    canonicalPath: "Public → Cancel Appointment",
    archetype: "Public",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/cancel/[token]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "public-reschedule",
    route: "/appointments/reschedule/[token]",
    canonicalPath: "Public → Reschedule Appointment",
    archetype: "Public",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/appointments/reschedule/[token]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
  {
    id: "public-waitlist-accept",
    route: "/waitlist/accept/[token]",
    canonicalPath: "Public → Waitlist Accept",
    archetype: "Public",
    stage: "bulk",
    artDirection: "golden",
    primaryFiles: routePrimaryFiles("/waitlist/accept/[token]"),
    sharedConsume: SHARED_CONSUME,
    sharedForbidden: SHARED_FORBIDDEN,
  },
];

export function buildMode4Manifest(): Mode4RebuildManifest {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_KIMI_MODE4_JOBS || 30),
    staggerMs: Number(process.env.KIMI_MODE4_STAGGER_MS || 5_000),
    entries: MODE4_REBUILD_ENTRIES,
  };
}

export function loadMode4Manifest(): Mode4RebuildManifest {
  if (existsSync(MANIFEST_PATH)) {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Mode4RebuildManifest;
  }
  return buildMode4Manifest();
}

export function saveMode4Manifest(manifest: Mode4RebuildManifest): void {
  mkdirSync(join(REPO_ROOT, ".ui-agent/mode4"), { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

export function getManifestEntryByRoute(route: string): Mode4ManifestEntry | undefined {
  const normalized = route.split("?")[0].replace(/\/$/, "") || "/";
  return loadMode4Manifest().entries.find((e) => e.route === normalized);
}

export function getManifestEntryById(id: string): Mode4ManifestEntry | undefined {
  return loadMode4Manifest().entries.find((e) => e.id === id);
}
