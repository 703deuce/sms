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

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  channels: Array<"sms" | "email" | "voice">;
  steps: WorkflowStep[];
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
  { label: "3 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 3, unit: "minutes", direction: "after" } },
  { label: "5 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 5, unit: "minutes", direction: "after" } },
  { label: "10 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 10, unit: "minutes", direction: "after" } },
  { label: "2 hours after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 2, unit: "hours", direction: "after" } },
  { label: "1 day after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 1, unit: "days", direction: "after" } },
];

export function describeTiming(t: WorkflowStepTiming): string {
  if (t.kind === "immediate") return "Immediately";
  const anchor =
    t.anchor === "appointment_end" ? "appointment end" : t.anchor === "booking_created" ? "booking" : "appointment start";
  return `${t.amount} ${t.unit} ${t.direction} ${anchor}`;
}

export const TRIGGER_OPTIONS = [
  { value: "appointment_booked", label: "Appointment booked" },
  { value: "appointment_confirmed", label: "Appointment confirmed" },
  { value: "appointment_rescheduled", label: "Appointment rescheduled" },
  { value: "appointment_canceled", label: "Appointment canceled" },
  { value: "appointment_completed", label: "Appointment completed" },
  { value: "appointment_no_show", label: "No-show" },
  { value: "before_appointment", label: "Before appointment" },
  { value: "after_appointment", label: "After appointment" },
  { value: "payment_received", label: "Payment succeeded" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "balance_due", label: "Balance due" },
];

export const ACTION_OPTIONS = [
  { value: "send_sms_customer", label: "Send SMS to customer", channel: "sms" as const },
  { value: "send_email_customer", label: "Send email to customer", channel: "email" as const },
  { value: "send_voice_reminder", label: "Call customer (voice reminder)", channel: "voice" as const },
  { value: "send_sms_staff", label: "Send SMS to staff", channel: "sms" as const },
  { value: "request_confirmation", label: "Request confirmation", channel: "sms" as const },
  { value: "send_payment_link", label: "Send payment link", channel: "sms" as const },
  { value: "send_review_request", label: "Send review request", channel: "sms" as const },
  { value: "send_reschedule_link", label: "Send reschedule link", channel: "sms" as const },
];

export const CONDITION_OPTIONS = [
  { value: "is_confirmed", label: "Appointment is confirmed" },
  { value: "not_confirmed", label: "Appointment is not confirmed" },
  { value: "has_phone", label: "Contact has a phone number" },
  { value: "has_email", label: "Contact has an email address" },
  { value: "has_sms_consent", label: "Contact has SMS consent" },
  { value: "balance_due", label: "Balance is due" },
  { value: "deposit_paid", label: "Deposit paid, balance remaining" },
  { value: "is_upcoming", label: "Appointment is upcoming" },
  { value: "customer_no_future_appointment", label: "Customer has no future appointment" },
];

export const APPOINTMENT_TYPES = [
  { id: "type_consult", name: "Initial Consultation" },
  { id: "type_followup", name: "Follow-Up Visit" },
  { id: "type_estimate", name: "Water Heater Estimate" },
  { id: "type_review", name: "Annual Review" },
  { id: "type_repair", name: "Repair Appointment" },
];

export const VOICE_TEMPLATES = [
  { id: "standard_appointment_reminder", name: "Standard Appointment Reminder", isDefault: true, keypad: "1 = Confirm appointment · 2 = Reschedule · 3 = Cancel appointment · 4 = Speak with us" },
  { id: "friendly_reminder", name: "Friendly Reminder", isDefault: false, keypad: "1 = Confirm appointment · 4 = Speak with us" },
];

export const MERGE_TAGS = [
  "{{first_name}}",
  "{{business_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{confirm_link}}",
  "{{reschedule_link}}",
  "{{cancel_link}}",
  "{{payment_link}}",
];

export const PREBUILT_TEMPLATES: Record<string, WorkflowTemplate> = {
  "standard-reminders": {
    id: "standard-reminders",
    name: "Standard Reminders",
    description: "Booking confirmation plus 24-hour and 2-hour SMS reminders for every appointment.",
    trigger: "appointment_booked",
    channels: ["sms"],
    steps: [
      {
        id: "s1",
        name: "Booking confirmation",
        timing: { kind: "immediate" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, your {{service}} appointment with {{business_name}} is booked for {{appointment_date}} at {{appointment_time}}. Confirm: {{confirm_link}}",
        enabled: true,
      },
      {
        id: "s2",
        name: "24-hour reminder",
        timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "Reminder: {{first_name}}, your {{service}} appointment is tomorrow at {{appointment_time}}. Reply YES to confirm or {{reschedule_link}} to reschedule.",
        enabled: true,
        stopIfConfirmed: true,
      },
      {
        id: "s3",
        name: "2-hour reminder",
        timing: { kind: "relative", anchor: "appointment_start", amount: 2, unit: "hours", direction: "before" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "See you soon, {{first_name}}! Your {{service}} appointment starts at {{appointment_time}} today. Need to make a change? {{reschedule_link}}",
        enabled: true,
        stopIfConfirmed: true,
      },
    ],
  },
  "confirmation-required": {
    id: "confirmation-required",
    name: "Confirmation Required",
    description: "Ask customers to confirm, then follow up if they don't respond.",
    trigger: "appointment_booked",
    channels: ["sms"],
    steps: [
      {
        id: "s1",
        name: "Confirmation request",
        timing: { kind: "relative", anchor: "booking_created", amount: 3, unit: "minutes", direction: "after" },
        action: "request_confirmation",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, please confirm your {{service}} appointment on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm.",
        enabled: true,
      },
      {
        id: "s2",
        name: "Follow-up if unconfirmed",
        timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "{{first_name}}, we haven't heard back — please confirm your {{service}} appointment tomorrow at {{appointment_time}}: {{confirm_link}}",
        enabled: true,
        stopIfConfirmed: true,
      },
    ],
  },
  "post-appointment-followup": {
    id: "post-appointment-followup",
    name: "Post-Appointment Follow-Up",
    description: "Thank customers after their visit and request a review.",
    trigger: "appointment_completed",
    channels: ["sms"],
    steps: [
      {
        id: "s1",
        name: "Thank-you message",
        timing: { kind: "relative", anchor: "appointment_end", amount: 2, unit: "hours", direction: "after" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: "Thanks for visiting {{business_name}} today, {{first_name}}! We appreciate your business.",
        enabled: true,
      },
      {
        id: "s2",
        name: "Review request",
        timing: { kind: "relative", anchor: "appointment_end", amount: 1, unit: "days", direction: "after" },
        action: "send_review_request",
        channel: "sms",
        messageTemplate: "{{first_name}}, how was your {{service}} experience? We'd love your feedback: {{review_link}}",
        enabled: true,
      },
    ],
  },
  "no-show-recovery": {
    id: "no-show-recovery",
    name: "No-Show Recovery",
    description: "Reach out after a no-show and offer an easy way to rebook.",
    trigger: "appointment_no_show",
    channels: ["sms"],
    steps: [
      {
        id: "s1",
        name: "No-show follow-up",
        timing: { kind: "immediate" },
        action: "send_reschedule_link",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, we missed you at your {{service}} appointment today. No worries — rebook here: {{reschedule_link}}",
        enabled: true,
      },
    ],
  },
};
