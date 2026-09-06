export type ReminderChannel = "sms" | "email" | "voice";
export type ReminderStepKey = "confirmation" | "reminder24h" | "reminder2h";

export type ReminderItem = {
  id: string;
  stepKey: ReminderStepKey;
  index: number;
  icon: "calendar" | "clock" | "message";
  title: string;
  badge: string;
  description: string;
  channel: ReminderChannel;
  template: string;
  preview: string;
  characters: number;
  segments: number;
  enabled: boolean;
  timeOfDayAt?: string;
  timeOfDayDaysBefore?: number;
  skipWeekends?: boolean;
  skipOffHours?: boolean;
  skipClosedDays?: boolean;
  stopOnReply?: boolean;
  attachIcs?: boolean;
};

export type TimelineEventState =
  | "sent"
  | "delivered"
  | "scheduled"
  | "opened"
  | "clicked"
  | "regenerated";

export type TimelineEvent = {
  id: string;
  channel: ReminderChannel;
  label: string;
  detail: string;
  state: TimelineEventState;
  stateLabel: string;
  time: string;
};

export type CalendarDefault = {
  id: string;
  name: string;
  appointmentCount: number;
  custom: boolean;
  steps: Record<ReminderStepKey, boolean>;
};

export const DEFAULT_TEMPLATES: Record<ReminderStepKey, string> = {
  confirmation:
    "Hi {{first_name}}, your {{service}} appointment with {{business_name}} is booked for {{appointment_date}} at {{appointment_time}}. Confirm: {{confirm_link}} · Reschedule: {{reschedule_link}} · Cancel: {{cancel_link}}",
  reminder24h:
    "Hi {{first_name}}, reminder: your {{service}} with {{business_name}} is tomorrow, {{appointment_date}} at {{appointment_time}}. Reply YES to confirm or {{reschedule_link}} to reschedule.",
  reminder2h:
    "Hi {{first_name}}, your {{service}} with {{business_name}} starts in about 2 hours ({{appointment_time}}). See you soon! {{join_meeting_line}}",
};

export const REMINDERS: ReminderItem[] = [
  {
    id: "booking-confirmation",
    stepKey: "confirmation",
    index: 1,
    icon: "calendar",
    title: "Booking confirmation",
    badge: "At booking",
    description: "Sent immediately when a customer books online.",
    channel: "sms",
    template: DEFAULT_TEMPLATES.confirmation,
    preview:
      "Hi Sarah, your Water Heater Estimate appointment with Bright Home Services is booked for Thu, Sep 10 at 2:00 PM. Confirm: https://trnsv.io/c/x8a2 · Reschedule: https://trnsv.io/r/x8a2 · Cancel: https://trnsv.io/x/x8a2",
    characters: 218,
    segments: 2,
    enabled: true,
    stopOnReply: true,
    skipOffHours: false,
  },
  {
    id: "24-hour",
    stepKey: "reminder24h",
    index: 2,
    icon: "clock",
    title: "24-hour reminder",
    badge: "24h before",
    description: "Sent the day before the appointment.",
    channel: "sms",
    template: DEFAULT_TEMPLATES.reminder24h,
    preview:
      "Hi Sarah, reminder: your Water Heater Estimate with Bright Home Services is tomorrow, Wed, Sep 9 at 2:00 PM. Reply YES to confirm or https://trnsv.io/r/x8a2 to reschedule.",
    characters: 172,
    segments: 2,
    enabled: true,
    timeOfDayAt: "09:00",
    timeOfDayDaysBefore: 1,
    skipWeekends: true,
    skipOffHours: true,
    skipClosedDays: true,
    stopOnReply: true,
  },
  {
    id: "2-hour",
    stepKey: "reminder2h",
    index: 3,
    icon: "message",
    title: "2-hour reminder",
    badge: "2h before",
    description: "Sent shortly before the appointment.",
    channel: "sms",
    template: DEFAULT_TEMPLATES.reminder2h,
    preview:
      "Hi Sarah, your Water Heater Estimate with Bright Home Services starts in about 2 hours (2:00 PM). See you soon!",
    characters: 108,
    segments: 1,
    enabled: true,
    skipWeekends: false,
    skipOffHours: true,
    stopOnReply: true,
  },
];

export const MERGE_TAGS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{business_name}}",
  "{{reschedule_link}}",
  "{{cancel_link}}",
  "{{confirm_link}}",
  "{{meeting_link}}",
  "{{join_meeting_line}}",
];

export const TEST_STEP_OPTIONS = [
  { key: "confirmation" as ReminderStepKey, label: "Booking confirmation" },
  { key: "reminder24h" as ReminderStepKey, label: "24-hour reminder" },
  { key: "reminder2h" as ReminderStepKey, label: "2-hour reminder" },
];

export const SMS_SENDER_LABEL =
  "Messages are sent via SMS from your business number. Standard message rates may apply.";

/**
 * Example reminder schedule for an upcoming appointment — shows the state machine:
 * confirmation sent, email tracked (delivered/opened/clicked), 24h + 2h scheduled,
 * and the regenerated entry after the customer rescheduled once.
 */
export const SCHEDULE_PREVIEW_APPOINTMENT = {
  customer: "Sarah Johnson",
  service: "Water Heater Estimate",
  when: "Thursday, Sep 10 · 2:00 PM ET",
};

export const SCHEDULE_TIMELINE: TimelineEvent[] = [
  {
    id: "t1",
    channel: "sms",
    label: "Booking confirmation",
    detail: "Sent immediately after online booking",
    state: "delivered",
    stateLabel: "Delivered",
    time: "Mon, Sep 7 · 10:03 AM",
  },
  {
    id: "t2",
    channel: "email",
    label: "Confirmation email (with .ics invite)",
    detail: "Open and link-click tracking enabled",
    state: "clicked",
    stateLabel: "Delivered · Opened · Link clicked",
    time: "Mon, Sep 7 · 10:03 AM",
  },
  {
    id: "t3",
    channel: "sms",
    label: "24-hour reminder",
    detail: "Scheduled for 9:00 AM the day before",
    state: "scheduled",
    stateLabel: "Scheduled",
    time: "Wed, Sep 9 · 9:00 AM",
  },
  {
    id: "t4",
    channel: "sms",
    label: "2-hour reminder",
    detail: "Scheduled 2 hours before the appointment",
    state: "scheduled",
    stateLabel: "Scheduled",
    time: "Thu, Sep 10 · 12:00 PM",
  },
];

export const SCHEDULE_REGENERATED_NOTE =
  "This customer rescheduled on Sep 7 at 2:41 PM. Pending reminders were canceled and recalculated automatically for the new time.";

export const CALENDAR_DEFAULTS: CalendarDefault[] = [
  {
    id: "cal-main",
    name: "Main calendar",
    appointmentCount: 42,
    custom: false,
    steps: { confirmation: true, reminder24h: true, reminder2h: true },
  },
  {
    id: "cal-installs",
    name: "Installations — field team",
    appointmentCount: 18,
    custom: true,
    steps: { confirmation: true, reminder24h: true, reminder2h: false },
  },
  {
    id: "cal-estimates",
    name: "Estimates — sales",
    appointmentCount: 9,
    custom: false,
    steps: { confirmation: true, reminder24h: true, reminder2h: true },
  },
];

export const STEP_SHORT_LABELS: Record<ReminderStepKey, string> = {
  confirmation: "Confirmation",
  reminder24h: "24h",
  reminder2h: "2h",
};
