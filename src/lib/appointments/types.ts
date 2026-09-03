export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "awaiting_confirmation"
  | "reschedule_requested"
  | "completed"
  | "canceled"
  | "cancelled"
  | "no_show";

export type ReminderChannel = "sms" | "email";

export type ReminderStepConfig = {
  enabled: boolean;
  channel: ReminderChannel;
  minutesBefore?: number;
  template: string;
  label: string;
};

export type AppointmentPlatformConfig = {
  bookingEnabled: boolean;
  timezone: string;
  businessPhone?: string;
  businessAddress?: string;
  businessDisplayName?: string;
  consentText?: string;
  termsUrl?: string;
  privacyUrl?: string;
  onboardingComplete?: boolean;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
  blackoutDates?: string[];
  reminders: {
    confirmation: ReminderStepConfig;
    reminder24h: ReminderStepConfig;
    reminder2h: ReminderStepConfig;
  };
};

export type AppointmentTypeConfig = {
  enabled?: boolean;
  description?: string;
  location?: string;
  priceDisplay?: string;
  bookingHours?: string;
  minimumBookingNoticeMinutes?: number;
  maximumBookingDaysAhead?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  timezone?: string;
  bookingQuestions?: Array<{
    id: string;
    label: string;
    type: "text" | "textarea" | "select" | "checkbox";
    required?: boolean;
    options?: string[];
  }>;
};

export type AppointmentTimelineEvent = {
  at: string;
  type: string;
  label: string;
  detail?: string;
};

export type AppointmentMetadata = {
  source?: "admin" | "public_booking" | "calendly" | "voice";
  inviteeName?: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  confirmToken?: string;
  cancelToken?: string;
  rescheduleToken?: string;
  smsConsent?: boolean;
  smsConsentAt?: string;
  reminderStatus?: string;
  reminderGeneration?: number;
  remindersSuppressed?: boolean;
  reminderSentKeys?: string[];
  timeline?: AppointmentTimelineEvent[];
  bookingAnswers?: Record<string, string>;
  location?: string;
  notes?: string;
  [key: string]: unknown;
};

export const DEFAULT_REMINDER_TEMPLATES = {
  confirmation:
    "Hi {{first_name}}, your {{service}} with {{business_name}} is confirmed for {{appointment_date}} at {{appointment_time}}. Reply YES to confirm. Reschedule: {{reschedule_link}} Cancel: {{cancel_link}}",
  reminder24h:
    "Reminder: {{service}} with {{business_name}} tomorrow at {{appointment_time}}. Reply YES to confirm. Reschedule: {{reschedule_link}}",
  reminder2h:
    "Reminder: {{service}} with {{business_name}} today at {{appointment_time}}. See you soon!",
};

export const DEFAULT_PLATFORM_CONFIG: AppointmentPlatformConfig = {
  bookingEnabled: false,
  timezone: "America/New_York",
  reminders: {
    confirmation: {
      enabled: true,
      channel: "sms",
      label: "Booking confirmation",
      template: DEFAULT_REMINDER_TEMPLATES.confirmation,
    },
    reminder24h: {
      enabled: true,
      channel: "sms",
      minutesBefore: 1440,
      label: "24-hour reminder",
      template: DEFAULT_REMINDER_TEMPLATES.reminder24h,
    },
    reminder2h: {
      enabled: true,
      channel: "sms",
      minutesBefore: 120,
      label: "2-hour reminder",
      template: DEFAULT_REMINDER_TEMPLATES.reminder2h,
    },
  },
};

export function normalizeAppointmentStatus(status: string): AppointmentStatus {
  const s = status.toLowerCase();
  if (s === "cancelled") return "canceled";
  if (s === "confirmed") return "confirmed";
  if (s === "awaiting_confirmation") return "awaiting_confirmation";
  if (s === "reschedule_requested") return "reschedule_requested";
  if (s === "completed") return "completed";
  if (s === "no_show" || s === "no-show") return "no_show";
  if (s === "scheduled") return "scheduled";
  if (s === "canceled") return "canceled";
  return "scheduled";
}

export function statusLabel(status: string): string {
  switch (normalizeAppointmentStatus(status)) {
    case "confirmed":
      return "Confirmed";
    case "awaiting_confirmation":
      return "Awaiting confirmation";
    case "reschedule_requested":
      return "Reschedule requested";
    case "completed":
      return "Completed";
    case "canceled":
      return "Canceled";
    case "no_show":
      return "No-show";
    default:
      return "Scheduled";
  }
}

export function lastCommunicationLabel(metadata: AppointmentMetadata): string | null {
  const timeline = metadata.timeline || [];
  const last = timeline[timeline.length - 1];
  return last?.label || null;
}
