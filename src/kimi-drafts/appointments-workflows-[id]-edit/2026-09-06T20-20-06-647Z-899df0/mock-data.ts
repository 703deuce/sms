export type WorkflowStepTiming =
  | { kind: "immediate" }
  | {
      kind: "relative";
      anchor: "appointment_start" | "appointment_end" | "booking_created";
      amount: number;
      unit: "minutes" | "hours" | "days";
      direction: "before" | "after";
    };

export type WorkflowStep = {
  id: string;
  name: string;
  timing: WorkflowStepTiming;
  action: string;
  channel: "sms" | "email" | "voice";
  messageTemplate: string;
  enabled: boolean;
  stopIfConfirmed?: boolean;
  voiceReminderTemplateId?: string;
};

export type WorkflowCondition = {
  id: string;
  operator: string;
  value?: string;
};

export type WorkflowRecord = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  channels: Array<"sms" | "email" | "voice">;
  enabled: boolean;
  appointmentTypeScope: { mode: "all" | "selected"; typeIds: string[] };
  conditionLogic: "and" | "or";
  conditions: WorkflowCondition[];
  steps: WorkflowStep[];
  updatedAt: string;
};

export const TIMING_PRESETS: Array<{ label: string; timing: WorkflowStepTiming }> = [
  { label: "Immediately", timing: { kind: "immediate" } },
  { label: "7 days before", timing: { kind: "relative", anchor: "appointment_start", amount: 7, unit: "days", direction: "before" } },
  { label: "48 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 48, unit: "hours", direction: "before" } },
  { label: "24 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" } },
  { label: "6 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 6, unit: "hours", direction: "before" } },
  { label: "2 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 2, unit: "hours", direction: "before" } },
  { label: "1 hour before", timing: { kind: "relative", anchor: "appointment_start", amount: 1, unit: "hours", direction: "before" } },
  { label: "30 minutes before", timing: { kind: "relative", anchor: "appointment_start", amount: 30, unit: "minutes", direction: "before" } },
  { label: "1 minute after booking", timing: { kind: "relative", anchor: "booking_created", amount: 1, unit: "minutes", direction: "after" } },
  { label: "5 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 5, unit: "minutes", direction: "after" } },
  { label: "10 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 10, unit: "minutes", direction: "after" } },
  { label: "2 hours after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 2, unit: "hours", direction: "after" } },
  { label: "1 day after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 1, unit: "days", direction: "after" } },
];

export function describeTiming(timing: WorkflowStepTiming): string {
  const preset = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(timing));
  if (preset) return preset.label;
  if (timing.kind === "immediate") return "Immediately";
  const anchor =
    timing.anchor === "appointment_end" ? "appointment end"
    : timing.anchor === "booking_created" ? "booking created"
    : "appointment start";
  return `${timing.amount} ${timing.unit} ${timing.direction} ${anchor}`;
}

export function timingSelectValue(timing: WorkflowStepTiming): string {
  const match = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(timing));
  return match ? JSON.stringify(match.timing) : "__custom__";
}

export const TRIGGER_OPTIONS = [
  { value: "appointment_booked", label: "Appointment booked" },
  { value: "appointment_confirmed", label: "Appointment confirmed" },
  { value: "appointment_rescheduled", label: "Appointment rescheduled" },
  { value: "appointment_canceled", label: "Appointment canceled" },
  { value: "appointment_completed", label: "Appointment completed" },
  { value: "appointment_no_show", label: "Appointment no-show" },
  { value: "before_appointment", label: "Before appointment" },
  { value: "after_appointment", label: "After appointment" },
  { value: "payment_received", label: "Payment received" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "balance_due", label: "Balance due" },
];

export const ACTION_OPTIONS = [
  { value: "send_sms_customer", label: "Send SMS to customer", channel: "sms" },
  { value: "send_email_customer", label: "Send email to customer", channel: "email" },
  { value: "voice_reminder_call", label: "Voice reminder call", channel: "voice" },
  { value: "send_sms_staff", label: "Send SMS to staff", channel: "sms" },
  { value: "request_confirmation", label: "Request confirmation", channel: "sms" },
  { value: "request_review", label: "Request review", channel: "sms" },
  { value: "send_payment_link", label: "Send payment link", channel: "sms" },
];

export const CONDITION_OPTIONS = [
  { value: "is_confirmed", label: "Appointment is confirmed" },
  { value: "not_confirmed", label: "Appointment is not confirmed" },
  { value: "is_canceled", label: "Appointment is canceled" },
  { value: "is_no_show", label: "Appointment is no-show" },
  { value: "has_phone", label: "Contact has phone number" },
  { value: "has_email", label: "Contact has email address" },
  { value: "has_sms_consent", label: "Contact has SMS consent" },
  { value: "is_upcoming", label: "Appointment is upcoming" },
  { value: "was_rescheduled", label: "Appointment was rescheduled" },
  { value: "appointment_type_equals", label: "Booking type is…", needsValue: true },
  { value: "balance_due", label: "Balance is due" },
  { value: "deposit_paid", label: "Deposit paid, balance remaining" },
  { value: "customer_has_future_appointment", label: "Customer has a future appointment" },
  { value: "customer_no_future_appointment", label: "Customer has no future appointment" },
  { value: "is_recurring", label: "Is part of a recurring series" },
];

export const APPOINTMENT_TYPES = [
  { id: "type_consult", name: "Initial Consultation" },
  { id: "type_followup", name: "Follow-Up Visit" },
  { id: "type_estimate", name: "On-Site Estimate" },
  { id: "type_review", name: "Annual Review" },
];

export const VOICE_TEMPLATES = [
  { id: "standard_appointment_reminder", name: "Standard Appointment Reminder", isDefault: true },
  { id: "voice_friendly", name: "Friendly Reminder", isDefault: false },
  { id: "voice_urgent", name: "Day-Of Reminder", isDefault: false },
];

export const DEFAULT_MESSAGE =
  "Hi {{first_name}}, this is {{business_name}} reminding you about your {{service}} appointment on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm.";

export const INITIAL_WORKFLOW: WorkflowRecord = {
  id: "wf_standard_reminders",
  name: "Standard Appointment Reminders",
  description: "Confirmation request on booking, plus 24h and 2h reminders before each appointment.",
  trigger: "appointment_booked",
  channels: ["sms"],
  enabled: true,
  appointmentTypeScope: { mode: "all", typeIds: [] },
  conditionLogic: "and",
  conditions: [
    { id: "cond_1", operator: "has_phone" },
    { id: "cond_2", operator: "has_sms_consent" },
  ],
  steps: [
    {
      id: "step_1",
      name: "Booking confirmation",
      timing: { kind: "immediate" },
      action: "request_confirmation",
      channel: "sms",
      messageTemplate:
        "Hi {{first_name}}, your {{service}} appointment with {{business_name}} is booked for {{appointment_date}} at {{appointment_time}}. Reply YES to confirm.",
      enabled: true,
    },
    {
      id: "step_2",
      name: "24-hour reminder",
      timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" },
      action: "send_sms_customer",
      channel: "sms",
      messageTemplate: DEFAULT_MESSAGE,
      enabled: true,
      stopIfConfirmed: true,
    },
    {
      id: "step_3",
      name: "2-hour reminder",
      timing: { kind: "relative", anchor: "appointment_start", amount: 2, unit: "hours", direction: "before" },
      action: "send_sms_customer",
      channel: "sms",
      messageTemplate:
        "Hi {{first_name}}, your {{service}} appointment with {{business_name}} starts in 2 hours. See you soon!",
      enabled: true,
      stopIfConfirmed: true,
    },
  ],
  updatedAt: "2026-09-06T14:32:00Z",
};

export const PREVIEW_RESULT = {
  sampleAppointment: {
    customer: "Sarah Johnson",
    service: "Initial Consultation",
    date: "Thursday, September 10, 2026",
    time: "2:00 PM",
    timezone: "Eastern Time",
  },
  scheduledSteps: [
    { stepName: "Booking confirmation", firesAt: "Immediately on booking", status: "will_send" },
    { stepName: "24-hour reminder", firesAt: "Wed, Sep 9 · 2:00 PM ET", status: "will_send" },
    { stepName: "2-hour reminder", firesAt: "Thu, Sep 10 · 12:00 PM ET", status: "will_send" },
  ],
};
