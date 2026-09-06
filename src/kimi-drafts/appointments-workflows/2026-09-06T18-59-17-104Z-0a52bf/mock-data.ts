export type Channel = "sms" | "email" | "voice" | "webhook" | "payment_link";
export type TimingKind = "immediate" | "relative";

export interface WorkflowStepTiming {
  kind: TimingKind;
  anchor?: "appointment_start" | "appointment_end" | "booking_created";
  amount?: number;
  unit?: "minutes" | "hours" | "days";
  direction?: "before" | "after";
}

export interface StepCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  timing: WorkflowStepTiming;
  action: string;
  channel: Channel;
  messageTemplate: string;
  enabled: boolean;
  voiceReminderTemplateId?: string;
  conditions?: StepCondition[];
  webhook?: { url: string; headers: string; payload: string };
  paymentLink?: { amountSource: string; amount?: string; memo: string };
}

export interface WorkflowRecord {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  channels: Channel[];
  steps: WorkflowStep[];
  active: boolean;
  status: "active" | "paused" | "draft";
  sourceType: "custom" | "template";
  templateId?: string;
  updatedAt: string;
  executions30d: number;
}

export interface PrebuiltTemplate {
  id: string;
  name: string;
  description: string;
  trigger: string;
  channels: Channel[];
  stepCount: number;
  category: "Reminders" | "Confirmations" | "Follow-up" | "Recovery" | "Payments";
}

export const TRIGGER_OPTIONS: Array<{ value: string; label: string; group: string }> = [
  { value: "appointment_booked", label: "Appointment booked", group: "Appointments" },
  { value: "appointment_confirmed", label: "Appointment confirmed", group: "Appointments" },
  { value: "appointment_rescheduled", label: "Appointment rescheduled", group: "Appointments" },
  { value: "appointment_canceled", label: "Appointment canceled", group: "Appointments" },
  { value: "appointment_completed", label: "Appointment completed", group: "Appointments" },
  { value: "appointment_no_show", label: "No-show", group: "Appointments" },
  { value: "before_appointment", label: "Before appointment", group: "Timing" },
  { value: "after_appointment", label: "After appointment", group: "Timing" },
  { value: "booking_requested", label: "Booking requested", group: "Booking" },
  { value: "booking_approved", label: "Booking approved", group: "Booking" },
  { value: "booking_rejected", label: "Booking rejected", group: "Booking" },
  { value: "payment_received", label: "Payment succeeded", group: "Payments" },
  { value: "payment_required", label: "Payment required", group: "Payments" },
  { value: "payment_failed", label: "Payment failed", group: "Payments" },
  { value: "deposit_paid", label: "Deposit paid", group: "Payments" },
  { value: "balance_due", label: "Balance due", group: "Payments" },
  { value: "waitlist_slot_available", label: "Waitlist slot available", group: "Appointments" },
  { value: "meeting_completed", label: "Meeting completed", group: "Meetings" },
  { value: "meeting_recap_ready", label: "Meeting recap ready", group: "Meetings" },
];

export function triggerLabel(trigger: string): string {
  return TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label || trigger;
}

export const ACTION_OPTIONS: Array<{ value: string; label: string; channel: Channel }> = [
  { value: "send_sms_customer", label: "Send SMS to customer", channel: "sms" },
  { value: "send_email_customer", label: "Send email to customer", channel: "email" },
  { value: "send_voice_reminder", label: "Call customer (voice reminder)", channel: "voice" },
  { value: "send_sms_team", label: "Send SMS to team", channel: "sms" },
  { value: "send_email_team", label: "Send email to team", channel: "email" },
  { value: "create_payment_link", label: "Create payment link", channel: "payment_link" },
  { value: "send_webhook", label: "Send outbound webhook", channel: "webhook" },
];

export const CONDITION_FIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "status", label: "Appointment status" },
  { value: "booking_type", label: "Booking type" },
  { value: "payment_status", label: "Payment status" },
  { value: "sms_consent", label: "SMS consent" },
];

export const CONDITION_VALUE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  status: [
    { value: "scheduled", label: "Scheduled" },
    { value: "confirmed", label: "Confirmed" },
    { value: "completed", label: "Completed" },
    { value: "canceled", label: "Canceled" },
    { value: "no_show", label: "No-show" },
  ],
  booking_type: [
    { value: "type_1", label: "Initial Consultation" },
    { value: "type_2", label: "Follow-Up Visit" },
    { value: "type_3", label: "Water Heater Estimate" },
    { value: "type_4", label: "Annual Checkup" },
  ],
  payment_status: [
    { value: "paid", label: "Paid in full" },
    { value: "deposit_paid", label: "Deposit paid" },
    { value: "balance_due", label: "Balance due" },
    { value: "unpaid", label: "Unpaid" },
  ],
  sms_consent: [
    { value: "granted", label: "Consent captured" },
    { value: "not_captured", label: "Consent not captured" },
    { value: "opted_out", label: "Opted out" },
  ],
};

export function conditionLabel(c: StepCondition): string {
  const field = CONDITION_FIELD_OPTIONS.find((f) => f.value === c.field)?.label || c.field;
  const value = (CONDITION_VALUE_OPTIONS[c.field] || []).find((v) => v.value === c.value)?.label || c.value;
  return `${field} ${c.operator} ${value}`;
}

export const TIMING_PRESETS: Array<{ label: string; timing: WorkflowStepTiming }> = [
  { label: "Immediately", timing: { kind: "immediate" } },
  { label: "5 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 5, unit: "minutes", direction: "after" } },
  { label: "7 days before", timing: { kind: "relative", anchor: "appointment_start", amount: 7, unit: "days", direction: "before" } },
  { label: "48 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 48, unit: "hours", direction: "before" } },
  { label: "24 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" } },
  { label: "2 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 2, unit: "hours", direction: "before" } },
  { label: "1 hour before", timing: { kind: "relative", anchor: "appointment_start", amount: 1, unit: "hours", direction: "before" } },
  { label: "30 minutes before", timing: { kind: "relative", anchor: "appointment_start", amount: 30, unit: "minutes", direction: "before" } },
  { label: "2 hours after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 2, unit: "hours", direction: "after" } },
  { label: "1 day after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 1, unit: "days", direction: "after" } },
];

export function describeTiming(t: WorkflowStepTiming): string {
  if (t.kind === "immediate") return "Immediately";
  const preset = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(t));
  if (preset) return preset.label;
  const anchor = t.anchor === "appointment_end" ? "appointment end" : t.anchor === "booking_created" ? "booking created" : "appointment start";
  return `${t.amount} ${t.unit} ${t.direction} ${anchor}`;
}

export const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  { id: "standard_reminders", name: "Standard Reminders", description: "Confirmation on booking, plus 24-hour and 2-hour SMS reminders before each appointment.", trigger: "appointment_booked", channels: ["sms"], stepCount: 3, category: "Reminders" },
  { id: "confirmation_required", name: "Confirmation Required", description: "Ask customers to confirm. Send follow-up nudges until they reply YES or the appointment starts.", trigger: "appointment_booked", channels: ["sms"], stepCount: 3, category: "Confirmations" },
  { id: "high_value", name: "High-Value Appointment", description: "Extra touchpoints for high-value bookings — voice reminder plus a personal team notification.", trigger: "appointment_booked", channels: ["sms", "voice"], stepCount: 4, category: "Reminders" },
  { id: "last_minute", name: "Last-Minute Reminders", description: "Tight sequence for same-day bookings: 2-hour and 30-minute reminders.", trigger: "appointment_booked", channels: ["sms"], stepCount: 2, category: "Reminders" },
  { id: "post_appointment", name: "Post-Appointment Follow-Up", description: "Thank customers after their appointment and link them to rebook.", trigger: "appointment_completed", channels: ["sms", "email"], stepCount: 2, category: "Follow-up" },
  { id: "review_request", name: "Review Request", description: "Ask for a review a day after a completed appointment.", trigger: "appointment_completed", channels: ["sms"], stepCount: 1, category: "Follow-up" },
  { id: "reschedule_followup", name: "Reschedule Follow-Up", description: "Confirm the new time and restart reminders when an appointment is rescheduled.", trigger: "appointment_rescheduled", channels: ["sms"], stepCount: 2, category: "Recovery" },
  { id: "no_show_recovery", name: "No-Show Recovery", description: "Reach out after a no-show with a rebooking link and notify the team.", trigger: "appointment_no_show", channels: ["sms", "email"], stepCount: 2, category: "Recovery" },
  { id: "re_engagement", name: "Re-Engagement / Book Again", description: "Invite past customers to book again a set number of days after their last visit.", trigger: "appointment_completed", channels: ["sms"], stepCount: 1, category: "Follow-up" },
  { id: "payment_followup", name: "Payment Follow-Up", description: "Chase outstanding balances and confirm when payments succeed.", trigger: "balance_due", channels: ["sms", "email"], stepCount: 2, category: "Payments" },
];

function step(id: string, name: string, timing: WorkflowStepTiming, action: string, channel: Channel, msg: string): WorkflowStep {
  return { id, name, timing, action, channel, messageTemplate: msg, enabled: true };
}

export const MOCK_WORKFLOWS: WorkflowRecord[] = [
  {
    id: "wf_1", name: "Standard Reminders", trigger: "appointment_booked", channels: ["sms"], active: true, status: "active",
    sourceType: "template", templateId: "standard_reminders", updatedAt: "2026-09-02T14:22:00Z", executions30d: 184,
    steps: [
      step("s1", "Booking confirmation", { kind: "immediate" }, "send_sms_customer", "sms", "Hi {{first_name}}, you're booked for {{service}} on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm."),
      step("s2", "24-hour reminder", { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" }, "send_sms_customer", "sms", "Reminder: {{service}} tomorrow at {{appointment_time}}. Need to change? {{reschedule_link}}"),
      step("s3", "2-hour reminder", { kind: "relative", anchor: "appointment_start", amount: 2, unit: "hours", direction: "before" }, "send_sms_customer", "sms", "See you at {{appointment_time}} today for {{service}} at {{business_name}}."),
    ],
  },
  {
    id: "wf_2", name: "No-Show Recovery", trigger: "appointment_no_show", channels: ["sms", "email"], active: true, status: "active",
    sourceType: "template", templateId: "no_show_recovery", updatedAt: "2026-08-28T09:10:00Z", executions30d: 12,
    steps: [
      step("s1", "No-show outreach", { kind: "immediate" }, "send_sms_customer", "sms", "Hi {{first_name}}, we missed you today at {{business_name}}. Rebook here: {{booking_link}}"),
      step("s2", "Team alert", { kind: "immediate" }, "send_email_team", "email", "No-show: {{customer_name}} — {{service}} on {{appointment_date}}."),
    ],
  },
  {
    id: "wf_3", name: "Review Request", trigger: "appointment_completed", channels: ["sms"], active: false, status: "paused",
    sourceType: "template", templateId: "review_request", updatedAt: "2026-08-15T17:40:00Z", executions30d: 0,
    steps: [
      step("s1", "Ask for review", { kind: "relative", anchor: "appointment_end", amount: 1, unit: "days", direction: "after" }, "send_sms_customer", "sms", "Thanks for visiting {{business_name}}, {{first_name}}! Would you leave us a quick review? {{review_link}}"),
    ],
  },
  {
    id: "wf_4", name: "Consult Intake Follow-Up", trigger: "appointment_booked", channels: ["sms", "email"], active: true, status: "active",
    sourceType: "custom", updatedAt: "2026-09-05T11:03:00Z", executions30d: 46,
    steps: [
      step("s1", "Intake form", { kind: "relative", anchor: "booking_created", amount: 5, unit: "minutes", direction: "after" }, "send_email_customer", "email", "Before your consultation, please complete your intake form: {{intake_link}}"),
      step("s2", "Prep reminder", { kind: "relative", anchor: "appointment_start", amount: 48, unit: "hours", direction: "before" }, "send_sms_customer", "sms", "Your consultation is in 2 days. Remember to bring your documents."),
    ],
  },
  {
    id: "wf_5", name: "Deposit Chase", trigger: "balance_due", channels: ["sms"], active: false, status: "draft",
    sourceType: "custom", updatedAt: "2026-09-06T16:30:00Z", executions30d: 0,
    steps: [
      step("s1", "Balance reminder", { kind: "immediate" }, "send_sms_customer", "sms", "Hi {{first_name}}, your balance of {{balance_amount}} for {{service}} is due. Pay here: {{payment_link}}"),
    ],
  },
];

export const APPOINTMENT_TYPES = [
  { id: "type_1", name: "Initial Consultation" },
  { id: "type_2", name: "Follow-Up Visit" },
  { id: "type_3", name: "Water Heater Estimate" },
  { id: "type_4", name: "Annual Checkup" },
];

export const MERGE_TAGS = ["{{first_name}}", "{{business_name}}", "{{service}}", "{{appointment_date}}", "{{appointment_time}}", "{{reschedule_link}}", "{{cancel_link}}", "{{booking_link}}"];
