export type AppointmentMetadata = {
  source?: "booking_page" | "manual" | "import" | "ai";
  staffName?: string;
  location?: string;
  durationMinutes?: number;
  lastCommunication?: {
    kind: "confirmation_sent" | "reminder_sent" | "customer_reply" | "reschedule_requested" | "none";
    at?: string;
  };
  reminderSchedule?: { label: string; state: "sent" | "scheduled" | "failed" | "suppressed" }[];
};

export type AppointmentRow = {
  id: string;
  inviteeName: string | null;
  inviteePhone: string | null;
  inviteeEmail: string | null;
  serviceName: string | null;
  startsAt: string;
  status:
    | "confirmed"
    | "awaiting_confirmation"
    | "scheduled"
    | "reschedule_requested"
    | "canceled"
    | "completed"
    | "no_show";
  timezone: string | null;
  reminderStatus: "sent" | "scheduled" | "delivered" | "failed" | "suppressed" | "none" | null;
  metadata: AppointmentMetadata;
  contact?: { id: string } | null;
};

const now = Date.now();
const H = 3600_000;
const D = 24 * H;
const at = (offsetMs: number, hour: number, minute = 0) => {
  const d = new Date(now + offsetMs);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const TABS = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "awaiting_confirmation", label: "Awaiting" },
  { id: "confirmed", label: "Confirmed" },
  { id: "reschedule_requested", label: "Reschedule" },
  { id: "canceled", label: "Canceled" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
] as const;

export const MOCK_APPOINTMENTS: AppointmentRow[] = [
  {
    id: "apt_01",
    inviteeName: "Sarah Johnson",
    inviteePhone: "+15714073615",
    inviteeEmail: "sarah.j@example.com",
    serviceName: "Water Heater Estimate",
    startsAt: at(0, 14, 0),
    status: "confirmed",
    timezone: "America/New_York",
    reminderStatus: "delivered",
    metadata: {
      source: "booking_page",
      staffName: "Mike Torres",
      location: "On-site — 812 Maple St",
      durationMinutes: 45,
      lastCommunication: { kind: "customer_reply", at: at(-H * 3, 9, 14) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "sent" },
        { label: "2h reminder", state: "scheduled" },
      ],
    },
    contact: { id: "ct_01" },
  },
  {
    id: "apt_02",
    inviteeName: "Anthony Reyes",
    inviteePhone: "+17035550142",
    inviteeEmail: "a.reyes@example.com",
    serviceName: "Initial Consultation",
    startsAt: at(0, 15, 30),
    status: "awaiting_confirmation",
    timezone: "America/New_York",
    reminderStatus: "scheduled",
    metadata: {
      source: "manual",
      staffName: "You",
      location: "Phone call",
      durationMinutes: 30,
      lastCommunication: { kind: "confirmation_sent", at: at(-H * 26, 11, 2) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "scheduled" },
      ],
    },
    contact: { id: "ct_02" },
  },
  {
    id: "apt_03",
    inviteeName: "Priya Natarajan",
    inviteePhone: "+12025550187",
    inviteeEmail: "priya.n@example.com",
    serviceName: "Follow-up Visit",
    startsAt: at(D, 10, 0),
    status: "confirmed",
    timezone: "America/New_York",
    reminderStatus: "scheduled",
    metadata: {
      source: "booking_page",
      staffName: "Dr. Chen",
      location: "Office — Suite 204",
      durationMinutes: 30,
      lastCommunication: { kind: "customer_reply", at: at(-H * 5, 8, 41) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "scheduled" },
        { label: "2h reminder", state: "scheduled" },
      ],
    },
    contact: { id: "ct_03" },
  },
  {
    id: "apt_04",
    inviteeName: "Marcus Webb",
    inviteePhone: "+13105550133",
    inviteeEmail: "mwebb@example.com",
    serviceName: "HVAC Maintenance",
    startsAt: at(D, 13, 0),
    status: "reschedule_requested",
    timezone: "America/Chicago",
    reminderStatus: "suppressed",
    metadata: {
      source: "booking_page",
      staffName: "Mike Torres",
      location: "On-site — 44 Oak Ave",
      durationMinutes: 60,
      lastCommunication: { kind: "reschedule_requested", at: at(-H * 2, 12, 5) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "suppressed" },
      ],
    },
    contact: { id: "ct_04" },
  },
  {
    id: "apt_05",
    inviteeName: "Elena Petrova",
    inviteePhone: "+14155550109",
    inviteeEmail: "elena.p@example.com",
    serviceName: "Annual Review",
    startsAt: at(D * 2, 9, 30),
    status: "scheduled",
    timezone: "America/Los_Angeles",
    reminderStatus: "scheduled",
    metadata: {
      source: "import",
      staffName: "You",
      location: "Video meeting",
      durationMinutes: 45,
      lastCommunication: { kind: "confirmation_sent", at: at(-H * 8, 10, 0) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "scheduled" },
      ],
    },
    contact: { id: "ct_05" },
  },
  {
    id: "apt_06",
    inviteeName: "David Kim",
    inviteePhone: "+12125550166",
    inviteeEmail: "dkim@example.com",
    serviceName: "Water Heater Estimate",
    startsAt: at(D * 2, 11, 0),
    status: "awaiting_confirmation",
    timezone: "America/New_York",
    reminderStatus: "failed",
    metadata: {
      source: "ai",
      staffName: "AI Booking",
      location: "On-site — 9 Birch Ln",
      durationMinutes: 45,
      lastCommunication: { kind: "reminder_sent", at: at(-H * 4, 8, 0) },
      reminderSchedule: [
        { label: "Confirmation", state: "failed" },
      ],
    },
    contact: { id: "ct_06" },
  },
  {
    id: "apt_07",
    inviteeName: "Rosa Delgado",
    inviteePhone: "+17135550128",
    inviteeEmail: "rosa.d@example.com",
    serviceName: "Initial Consultation",
    startsAt: at(D * 3, 16, 0),
    status: "confirmed",
    timezone: "America/Chicago",
    reminderStatus: "scheduled",
    metadata: {
      source: "booking_page",
      staffName: "Dr. Chen",
      location: "Office — Suite 204",
      durationMinutes: 30,
      lastCommunication: { kind: "customer_reply", at: at(-H * 30, 14, 22) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "scheduled" },
      ],
    },
    contact: { id: "ct_07" },
  },
  {
    id: "apt_08",
    inviteeName: "James O'Connor",
    inviteePhone: "+16175550144",
    inviteeEmail: "j.oconnor@example.com",
    serviceName: "HVAC Maintenance",
    startsAt: at(D * 4, 10, 30),
    status: "scheduled",
    timezone: "America/New_York",
    reminderStatus: "none",
    metadata: {
      source: "manual",
      staffName: "Mike Torres",
      location: "On-site — 301 Elm Dr",
      durationMinutes: 60,
      lastCommunication: { kind: "none" },
      reminderSchedule: [],
    },
    contact: { id: "ct_08" },
  },
  {
    id: "apt_09",
    inviteeName: "Hannah Lee",
    inviteePhone: "+12065550177",
    inviteeEmail: "hannah.lee@example.com",
    serviceName: "Follow-up Visit",
    startsAt: at(-D, 11, 0),
    status: "completed",
    timezone: "America/Los_Angeles",
    reminderStatus: "delivered",
    metadata: {
      source: "booking_page",
      staffName: "Dr. Chen",
      location: "Office — Suite 204",
      durationMinutes: 30,
      lastCommunication: { kind: "reminder_sent", at: at(-D - H * 2, 9, 0) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "sent" },
        { label: "2h reminder", state: "sent" },
      ],
    },
    contact: { id: "ct_09" },
  },
  {
    id: "apt_10",
    inviteeName: "Tom Becker",
    inviteePhone: "+13125550111",
    inviteeEmail: "tbecker@example.com",
    serviceName: "Annual Review",
    startsAt: at(-D, 15, 0),
    status: "no_show",
    timezone: "America/Chicago",
    reminderStatus: "delivered",
    metadata: {
      source: "booking_page",
      staffName: "You",
      location: "Video meeting",
      durationMinutes: 45,
      lastCommunication: { kind: "reminder_sent", at: at(-D - H * 2, 13, 0) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "sent" },
      ],
    },
    contact: { id: "ct_10" },
  },
  {
    id: "apt_11",
    inviteeName: "Aisha Bello",
    inviteePhone: "+19175550123",
    inviteeEmail: "aisha.b@example.com",
    serviceName: "Initial Consultation",
    startsAt: at(-D * 2, 10, 0),
    status: "canceled",
    timezone: "America/New_York",
    reminderStatus: "suppressed",
    metadata: {
      source: "import",
      staffName: "Dr. Chen",
      location: "Office — Suite 204",
      durationMinutes: 30,
      lastCommunication: { kind: "customer_reply", at: at(-D * 2 - H * 5, 9, 12) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "suppressed" },
      ],
    },
    contact: { id: "ct_11" },
  },
  {
    id: "apt_12",
    inviteeName: "George Martin",
    inviteePhone: "+14045550198",
    inviteeEmail: "gmartin@example.com",
    serviceName: "Water Heater Estimate",
    startsAt: at(D * 5, 9, 0),
    status: "confirmed",
    timezone: "America/New_York",
    reminderStatus: "scheduled",
    metadata: {
      source: "booking_page",
      staffName: "Mike Torres",
      location: "On-site — 77 Pine Ct",
      durationMinutes: 45,
      lastCommunication: { kind: "customer_reply", at: at(-H * 50, 16, 47) },
      reminderSchedule: [
        { label: "Confirmation", state: "sent" },
        { label: "24h reminder", state: "scheduled" },
      ],
    },
    contact: { id: "ct_12" },
  },
];

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    confirmed: "Confirmed",
    awaiting_confirmation: "Awaiting confirmation",
    scheduled: "Scheduled",
    reschedule_requested: "Reschedule requested",
    canceled: "Canceled",
    cancelled: "Canceled",
    completed: "Completed",
    no_show: "No-show",
  };
  return map[status.toLowerCase()] || status;
}

export function reminderLabel(status: AppointmentRow["reminderStatus"]): string {
  switch (status) {
    case "sent": return "Reminder sent";
    case "delivered": return "Reminders delivered";
    case "scheduled": return "Reminder scheduled";
    case "failed": return "Reminder failed";
    case "suppressed": return "Reminders stopped";
    default: return "No reminders";
  }
}

export function lastCommunicationLabel(meta: AppointmentMetadata): string {
  const lc = meta.lastCommunication;
  if (!lc || lc.kind === "none") return "—";
  const when = lc.at
    ? new Date(lc.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  const kind =
    lc.kind === "confirmation_sent" ? "Confirmation sent" :
    lc.kind === "reminder_sent" ? "Reminder sent" :
    lc.kind === "customer_reply" ? "Customer replied" :
    "Reschedule requested";
  return when ? `${kind} · ${when}` : kind;
}

export function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return phone;
}

export function formatDay(iso: string, tz?: string | null): string {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: tz || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(iso: string, tz?: string | null): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: tz || undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function groupKey(iso: string, tz?: string | null): string {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: tz || undefined,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
