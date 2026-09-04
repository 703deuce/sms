/**
 * Launch-visible Appointments V1 screen inventory for Kimi Mode 3 polish pass.
 * Scope = current flat appointments nav (no Numbers, Compliance, hidden Mass SMS/MCTB/Fax).
 */
import type { WalkthroughAction } from "./polish-targets";

export type AppointmentsV1Screen = {
  id: string;
  route: string;
  /** Path to capture (may include resolved ids after discovery). */
  path: string;
  label: string;
  area: string;
  batch: number;
  purpose: string;
  requiresAuth: boolean;
  viewport: "desktop" | "mobile";
  actions?: WalkthroughAction[];
  /** Resolve at capture time via browser/API discovery. */
  resolve?: "appointment-detail" | "contact-detail" | "booking-slug" | "types-edit";
};

export const APPOINTMENTS_V1_KIMI_INSTRUCTION = `Review this actual Transovo screen and substantially improve its UI while preserving all existing functionality and information architecture.

This is a modern SaaS application focused on appointments, customer reminders, and conversations for small business owners.

Improve hierarchy, spacing, typography, card/table treatment, controls, empty states, status indicators, forms, responsiveness, and overall polish.

Do not remove required functionality. Avoid generic dashboard bloat. The page should feel production-grade and visually coherent with the rest of Transovo.

Match global patterns: consistent page titles, content width, card radius, borders, buttons, badges, tables, and form inputs.`;

export const APPOINTMENTS_V1_SCREENS: AppointmentsV1Screen[] = [
  // ── Batch 1: Appointments core ──
  {
    id: "overview",
    route: "/appointments/overview",
    path: "/appointments/overview",
    label: "Overview",
    area: "Main",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose:
      "Today/attention dashboard. User must see today's appointments, confirmed, awaiting confirmation, reschedule requests, unread conversations, and Needs Attention within seconds.",
  },
  {
    id: "calendar",
    route: "/appointments/calendar",
    path: "/appointments/calendar",
    label: "Calendar",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose:
      "Primary schedule view. Calendar is the visual focus — compact events, clear navigation, subtle status, fast New Appointment. No dashboard clutter around the calendar.",
  },
  {
    id: "appointments-list",
    route: "/appointments",
    path: "/appointments",
    label: "Scheduled list",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose:
      "Operational appointment list: Date/Time, Customer, Service, status, reminder state, last communication, actions. Filters easy to scan.",
  },
  {
    id: "appointment-detail",
    route: "/appointments/[id]",
    path: "/appointments",
    label: "Appointment detail",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    resolve: "appointment-detail",
    purpose:
      "Most important info first: customer, service, date/time, status, reminders. Obvious actions: Message, Reschedule, Cancel, Mark Complete. Clean timeline.",
  },
  {
    id: "appointment-new",
    route: "/appointments/new",
    path: "/appointments/new",
    label: "New appointment",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose: "Create appointment form — service, slot, customer fields. Fast and clear for staff booking on behalf of customers.",
  },
  {
    id: "types-list",
    route: "/appointments/types",
    path: "/appointments/types",
    label: "Appointment types list",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose:
      "Reusable services/configurations — not generic DB rows. Edit, Preview, Copy link, Active/Inactive visible.",
  },
  {
    id: "types-edit",
    route: "/appointments/types",
    path: "/appointments/types",
    label: "Appointment type editor",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    resolve: "types-edit",
    purpose: "Edit/create appointment type — duration, location, booking questions, notice rules.",
  },
  {
    id: "availability",
    route: "/appointments/availability",
    path: "/appointments/availability",
    label: "Availability",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose:
      "Weekly hours and date overrides — easy to understand visually. Booking rules (notice, horizon, timezone) without implementation complexity.",
  },
  {
    id: "reminders",
    route: "/appointments/reminders",
    path: "/appointments/reminders",
    label: "Reminder settings",
    area: "Appointments",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose:
      "Visual reminder sequence: confirmation → 24h → 2h. Each step editable. Preview and Send Test obvious. Not an automation builder.",
  },
  {
    id: "analytics",
    route: "/appointments/analytics",
    path: "/appointments/analytics",
    label: "Analytics",
    area: "Insights",
    batch: 1,
    requiresAuth: true,
    viewport: "desktop",
    purpose: "Simple appointment metrics — booked, confirmed, canceled, reminders, bookings over time. 7/30 day useful, not enterprise BI.",
  },
  // ── Batch 2: Booking, setup, conversations, contacts ──
  {
    id: "booking-settings",
    route: "/appointments/booking",
    path: "/appointments/booking",
    label: "Booking page settings",
    area: "Appointments",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    purpose:
      "Public booking page config — enable toggle, copy link, business info, SMS consent, AI Booking Protection mode, suspicious bookings review.",
  },
  {
    id: "setup",
    route: "/appointments/setup",
    path: "/appointments/setup",
    label: "Get started / onboarding",
    area: "Appointments",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    purpose: "Onboarding checklist with progress — setup booking system steps without blocking usage.",
  },
  {
    id: "conversations-empty",
    route: "/conversations",
    path: "/conversations",
    label: "Conversations — no thread",
    area: "Conversations",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    purpose: "Business inbox — thread list, empty state when no conversation selected. Not a raw SMS log.",
  },
  {
    id: "conversations-thread",
    route: "/conversations",
    path: "/conversations",
    label: "Conversations — thread open",
    area: "Conversations",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    actions: [{ type: "click", selector: "aside a, [data-conversation-row], .conversation-row, table tbody tr" }, { type: "wait", ms: 1200 }],
    purpose:
      "Selected conversation — message bubbles, composer, appointment context card visible, customer obvious.",
  },
  {
    id: "conversations-unread",
    route: "/conversations",
    path: "/conversations",
    label: "Conversations — unread filter",
    area: "Conversations",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    actions: [{ type: "click", selector: 'button:has-text("Unread"), a:has-text("Unread")' }, { type: "wait", ms: 800 }],
    purpose: "Unread conversations filter — unread prominence in thread list.",
  },
  {
    id: "contacts-list",
    route: "/contacts",
    path: "/contacts",
    label: "Contacts list",
    area: "Contacts",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    purpose: "Lightweight customer CRM list — search, filters, scan-friendly rows.",
  },
  {
    id: "contact-detail",
    route: "/contacts/[id]",
    path: "/contacts",
    label: "Contact detail",
    area: "Contacts",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    resolve: "contact-detail",
    purpose:
      "Contact record — identity, upcoming appointment, history, conversations, consent. Organized sections, not one giant card.",
  },
  {
    id: "settings",
    route: "/settings",
    path: "/settings",
    label: "Settings",
    area: "Account",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    purpose: "Account/workspace settings — consistent with global shell.",
  },
  {
    id: "help",
    route: "/getting-started",
    path: "/getting-started",
    label: "Help / getting started",
    area: "Account",
    batch: 2,
    requiresAuth: true,
    viewport: "desktop",
    purpose: "Help and getting started — clear support entry.",
  },
  // ── Batch 3: Public booking (consumer-facing) ──
  {
    id: "public-book-service",
    route: "/book",
    path: "/book/demo",
    label: "Public booking — service selection",
    area: "Public booking",
    batch: 3,
    requiresAuth: false,
    viewport: "desktop",
    resolve: "booking-slug",
    purpose: "Customer picks service — business name, description, duration, timezone. Clean consumer-facing polish.",
  },
  {
    id: "public-book-datetime",
    route: "/book",
    path: "/book/demo",
    label: "Public booking — date/time",
    area: "Public booking",
    batch: 3,
    requiresAuth: false,
    viewport: "desktop",
    resolve: "booking-slug",
    actions: [
      { type: "click", selector: "button[type='button']:has-text('min'), .rounded-xl.border button" },
      { type: "wait", ms: 1500 },
    ],
    purpose: "Available dates and times — calendar/slot picker is the focus. Mobile-friendly layout on narrow viewports.",
  },
  {
    id: "public-book-info",
    route: "/book",
    path: "/book/demo",
    label: "Public booking — customer info",
    area: "Public booking",
    batch: 3,
    requiresAuth: false,
    viewport: "desktop",
    resolve: "booking-slug",
    actions: [
      { type: "click", selector: "button[type='button']:has-text('min'), .rounded-xl.border button" },
      { type: "wait", ms: 1200 },
      { type: "click", selector: "button:has-text('Continue')" },
      { type: "wait", ms: 800 },
    ],
    purpose: "Customer information + SMS consent (unchecked default) + terms. Short form, no account required.",
  },
  {
    id: "public-book-mobile",
    route: "/book",
    path: "/book/demo",
    label: "Public booking — mobile service step",
    area: "Public booking",
    batch: 3,
    requiresAuth: false,
    viewport: "mobile",
    resolve: "booking-slug",
    purpose: "Mobile booking flow — service step must be excellent on phone. Fast, no clutter.",
  },
];

export function screensForBatch(batch: number): AppointmentsV1Screen[] {
  return APPOINTMENTS_V1_SCREENS.filter((s) => s.batch === batch);
}

export function allBatches(): number[] {
  return [...new Set(APPOINTMENTS_V1_SCREENS.map((s) => s.batch))].sort((a, b) => a - b);
}
