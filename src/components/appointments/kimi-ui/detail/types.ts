export type ReminderStep = {
  key: string;
  label: string;
  channel: string;
  status: "sent" | "scheduled" | "failed" | "disabled" | "skipped";
  scheduledFor?: string;
};

export type TimelineEvent = {
  id: string;
  at: string;
  type: string;
  title: string;
  detail?: string;
  actor?: string;
};

export type InternalNote = {
  id: string;
  at: string;
  authorName: string;
  body: string;
};

export type Appointment = {
  id: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteePhone: string;
  location: string;
  durationMinutes: number;
  reminderStatus: string;
  smsConsent: boolean;
  paymentStatus: string;
  paymentAmountCents: number;
  pendingApproval: boolean;
  remindersSuppressed: boolean;
  source: string;
  notes: string;
  bookingAnswers: Record<string, string>;
  reminderSchedule: ReminderStep[];
  timeline: TimelineEvent[];
  internalNotes: InternalNote[];
  extraRecipients: Array<{ name?: string; email?: string; phone?: string }>;
  contactId: string;
  /** Integration availability flags (drive disconnected/unavailable states) */
  paymentsConnected: boolean;
  videoProvisioned: boolean;
  externalId?: string | null;
  policySnapshot?: {
    capturedAt?: string;
    cancellation?: { allowed?: string; cutoffHours?: number; policyText?: string };
    reschedule?: { allowed?: string; cutoffHours?: number; policyText?: string };
    extendedCancellation?: { lateFeeCents?: number };
    paymentMode?: string;
  } | null;
  smsConsentAt?: string | null;
  smsConsentText?: string | null;
  serviceLines?: Array<{
    id: string;
    serviceName: string;
    staffId?: string | null;
    startsAt: string;
    endsAt: string;
    displayOrder: number;
  }>;
  contracts?: Array<{
    id: string;
    status: string;
    templateVersion?: string | null;
    signedAt?: string | null;
    createdAt: string;
  }>;
  contractTemplates?: Array<{ id: string; name: string; version: string }>;
  enrichment?: {
    servicePhases: Array<{
      name: string;
      phaseKind: string;
      startsAt: string;
      endsAt: string;
      staffRequired: boolean;
    }>;
    roomsEquipment: Array<{ label: string; quantity?: number; fromGroup?: string }>;
    addOns: Array<{ name: string; priceCents?: number; durationMinutes?: number }>;
    intakeResponses: Array<{
      formId: string;
      formName: string;
      answers: Record<string, unknown>;
      attachments: Array<{ fieldId: string; filename: string; url?: string; mimeType?: string }>;
    }>;
    entitlementPayment?: {
      method: "package" | "gift";
      packageName?: string;
      creditsUsed?: number;
      creditsRemaining?: number;
      membershipName?: string;
      monthlyCreditsUsed?: number;
      monthlyCreditsRemaining?: number;
      giftCode?: string;
      amountCentsWaived?: number;
    };
    recurringSeries?: {
      seriesId: string;
      frequencyLabel: string;
      occurrenceIndex: number;
      totalOccurrences?: number;
      rangeLabel?: string;
    };
    termsAcceptance?: {
      accepted: boolean;
      acceptedAt?: string;
      termsVersion?: string;
      termsUrl?: string;
    };
    financialSummary: {
      totalCents?: number;
      depositCents?: number;
      paidCents?: number;
      balanceCents?: number;
      refundedCents?: number;
      paymentMethod?: string;
    };
  };
  refundAmountCents?: number;
};

export const appointment: Appointment = {
  id: "appt_9f2k",
  serviceName: "Water Heater Estimate",
  staffName: "Mike Torres",
  startsAt: "2026-09-10T14:00:00-04:00",
  endsAt: "2026-09-10T14:45:00-04:00",
  timezone: "America/New_York",
  status: "awaiting_confirmation",
  inviteeName: "Sarah Johnson",
  inviteeEmail: "sarah.johnson@example.com",
  inviteePhone: "+15714073615",
  location: "Customer site — 214 Maple St, Alexandria, VA",
  durationMinutes: 45,
  reminderStatus: "scheduled",
  smsConsent: true,
  paymentStatus: "paid",
  paymentAmountCents: 5000,
  pendingApproval: false,
  remindersSuppressed: false,
  source: "Public booking page",
  notes:
    "Customer mentioned the existing unit is 12 years old and leaking at the base. Prefers morning follow-up calls.",
  bookingAnswers: {
    "What type of water heater do you have?": "Gas tank, 50 gal",
    "Is the unit accessible?": "Yes — basement, clear path",
  },
  reminderSchedule: [
    {
      key: "confirmation",
      label: "Booking confirmation",
      channel: "SMS",
      status: "sent",
      scheduledFor: "2026-09-07T10:03:00-04:00",
    },
    {
      key: "reminder_24h",
      label: "Reminder — 24 hours before",
      channel: "SMS",
      status: "scheduled",
      scheduledFor: "2026-09-09T14:00:00-04:00",
    },
    {
      key: "reminder_2h",
      label: "Reminder — 2 hours before",
      channel: "SMS",
      status: "scheduled",
      scheduledFor: "2026-09-10T12:00:00-04:00",
    },
  ],
  timeline: [
    {
      id: "t1",
      at: "2026-09-07T10:03:00-04:00",
      type: "created",
      title: "Appointment booked via public booking page",
      detail: "Booking page: Bright Plumbing — Estimates",
    },
    {
      id: "t2",
      at: "2026-09-07T10:03:12-04:00",
      type: "consent",
      title: "SMS consent recorded",
      detail: "Appointment reminder texts — booking page checkbox",
    },
    {
      id: "t3",
      at: "2026-09-07T10:03:31-04:00",
      type: "message",
      title: "Confirmation SMS sent",
      detail: "“Bright Plumbing: You’re booked for Water Heater Estimate on Thu, Sep 10 at 2:00 PM. Reply YES to confirm.”",
    },
    {
      id: "t4",
      at: "2026-09-07T10:04:02-04:00",
      type: "calendar",
      title: "Calendar event created",
      detail: "Google — Bright Plumbing calendar",
    },
    {
      id: "t5",
      at: "2026-09-07T10:05:20-04:00",
      type: "payment",
      title: "Deposit paid — $50.00",
      detail: "Card •••• 4242 · Receipt sent by email",
    },
    {
      id: "t6",
      at: "2026-09-08T09:14:00-04:00",
      type: "note",
      title: "Internal note added",
      detail: "Called to verify basement access. — Mike T.",
      actor: "Mike Torres",
    },
  ],
  internalNotes: [
    {
      id: "n1",
      at: "2026-09-08T09:14:00-04:00",
      authorName: "Mike Torres",
      body: "Called to verify basement access — customer confirmed clear path to unit.",
    },
  ],
  extraRecipients: [{ name: "Dan Johnson", email: "dan.johnson@example.com" }],
  contactId: "ct_8412",
  paymentsConnected: true,
  videoProvisioned: true,
};

/* ---------------- State variants (preview states by id) ---------------- */

const canceledAppt: Appointment = {
  ...appointment,
  id: "appt_canceled",
  status: "canceled",
  paymentStatus: "refunded",
  reminderSchedule: appointment.reminderSchedule.map((s) =>
    s.status === "scheduled" ? { ...s, status: "skipped" as const } : s,
  ),
  timeline: [
    {
      id: "tc1",
      at: "2026-09-09T08:12:00-04:00",
      type: "canceled",
      title: "Appointment canceled",
      detail: "Pending reminders stopped. Customer notified by SMS and email.",
    },
    ...appointment.timeline,
  ],
};

const completedAppt: Appointment = {
  ...appointment,
  id: "appt_completed",
  status: "completed",
  reminderSchedule: appointment.reminderSchedule.map((s) => ({
    ...s,
    status: "sent" as const,
  })),
  timeline: [
    {
      id: "td1",
      at: "2026-09-10T14:52:00-04:00",
      type: "confirmed",
      title: "Appointment completed",
      detail: "Marked complete by Mike Torres.",
    },
    ...appointment.timeline,
  ],
};

const noShowAppt: Appointment = {
  ...appointment,
  id: "appt_noshow",
  status: "no_show",
  reminderSchedule: appointment.reminderSchedule.map((s) => ({
    ...s,
    status: "sent" as const,
  })),
  timeline: [
    {
      id: "tn1",
      at: "2026-09-10T15:10:00-04:00",
      type: "canceled",
      title: "Marked as no-show",
      detail: "Customer did not arrive and did not respond. Auto-scan confirmed no-show.",
    },
    ...appointment.timeline,
  ],
};

const noConsentAppt: Appointment = {
  ...appointment,
  id: "appt_noconsent",
  smsConsent: false,
  source: "Imported from Google Calendar",
  reminderSchedule: appointment.reminderSchedule.map((s) => ({
    ...s,
    status: "disabled" as const,
  })),
};

const pendingApprovalAppt: Appointment = {
  ...appointment,
  id: "appt_pending",
  status: "scheduled",
  pendingApproval: true,
};

const disconnectedAppt: Appointment = {
  ...appointment,
  id: "appt_disconnected",
  paymentsConnected: false,
  videoProvisioned: false,
};

/** Mock record store. "error" simulates a load failure. */
export const appointmentsById: Record<string, Appointment | "error"> = {
  [appointment.id]: appointment,
  appt_canceled: canceledAppt,
  appt_completed: completedAppt,
  appt_noshow: noShowAppt,
  appt_noconsent: noConsentAppt,
  appt_pending: pendingApprovalAppt,
  appt_disconnected: disconnectedAppt,
  appt_error: "error",
  // appt_missing intentionally absent → not-found state
};

export const rescheduleSlots = [
  { startsAt: "2026-09-11T09:00:00-04:00", endsAt: "2026-09-11T09:45:00-04:00" },
  { startsAt: "2026-09-11T10:30:00-04:00", endsAt: "2026-09-11T11:15:00-04:00" },
  { startsAt: "2026-09-11T13:00:00-04:00", endsAt: "2026-09-11T13:45:00-04:00" },
  { startsAt: "2026-09-11T15:30:00-04:00", endsAt: "2026-09-11T16:15:00-04:00" },
  { startsAt: "2026-09-12T09:30:00-04:00", endsAt: "2026-09-12T10:15:00-04:00" },
  { startsAt: "2026-09-12T11:00:00-04:00", endsAt: "2026-09-12T11:45:00-04:00" },
];

export const videoMeeting = {
  id: "vm_51",
  status: "scheduled",
  maxParticipants: 8,
  recordingMode: "automatic",
  aiRecapEnabled: true,
  guestUrl: "https://meet.transovo.io/m/bright-x81k",
};

export const meetingSession = {
  id: "ms_77",
  status: "scheduled",
  meetingPlatform: "zoom",
  meetingUrl: "https://zoom.us/j/9145550123",
  autoJoin: true,
};
