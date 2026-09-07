// Transovo — appointment workflows domain mock data
// Mirrors src/lib/appointment-workflows/types.ts + templates.ts contracts.

export type WorkflowStepTiming =
  | { kind: "immediate" }
  | {
      kind: "relative";
      anchor: "appointment_start" | "appointment_end" | "booking_created";
      amount: number;
      unit: "minutes" | "hours" | "days";
      direction: "before" | "after";
    };

export type WorkflowAction =
  | "send_sms_customer"
  | "send_email_customer"
  | "send_sms_team"
  | "voice_reminder"
  | "request_review"
  | "wait_for_reply";

export type WorkflowTrigger =
  | "appointment_booked"
  | "appointment_confirmed"
  | "appointment_canceled"
  | "appointment_no_show"
  | "appointment_completed"
  | "before_appointment"
  | "after_appointment"
  | "payment_required"
  | "payment_received";

export interface WorkflowStep {
  id: string;
  name: string;
  timing: WorkflowStepTiming;
  action: WorkflowAction;
  channel: "sms" | "email" | "voice";
  messageTemplate: string;
  enabled: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "Reminders" | "Confirmation" | "Follow-up" | "Payments";
  trigger: WorkflowTrigger;
  channels: ("sms" | "email" | "voice")[];
  recommended?: boolean;
  steps: WorkflowStep[];
}

export interface AppointmentWorkflowRecord {
  id: string;
  name: string;
  templateId?: string;
  trigger: WorkflowTrigger;
  enabled: boolean;
  steps: WorkflowStep[];
  updatedAt: string;
}

export function triggerLabel(trigger: WorkflowTrigger): string {
  const labels: Record<string, string> = {
    appointment_booked: "Appointment booked",
    appointment_confirmed: "Appointment confirmed",
    appointment_canceled: "Appointment canceled",
    appointment_no_show: "No-show",
    appointment_completed: "Appointment completed",
    before_appointment: "Before appointment",
    after_appointment: "After appointment",
    payment_required: "Payment required",
    payment_received: "Payment succeeded",
  };
  return labels[trigger] || trigger;
}

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

export const ACTION_OPTIONS: Array<{ value: WorkflowAction; label: string }> = [
  { value: "send_sms_customer", label: "Send SMS to customer" },
  { value: "send_email_customer", label: "Send email to customer" },
  { value: "send_sms_team", label: "Notify team (SMS)" },
  { value: "voice_reminder", label: "Voice reminder call" },
  { value: "request_review", label: "Request a review" },
  { value: "wait_for_reply", label: "Wait for customer reply" },
];

export const TRIGGER_OPTIONS: Array<{ value: WorkflowTrigger; label: string }> = [
  { value: "appointment_booked", label: "Appointment booked" },
  { value: "appointment_confirmed", label: "Appointment confirmed" },
  { value: "appointment_canceled", label: "Appointment canceled" },
  { value: "appointment_no_show", label: "No-show" },
  { value: "appointment_completed", label: "Appointment completed" },
  { value: "before_appointment", label: "Before appointment" },
  { value: "after_appointment", label: "After appointment" },
  { value: "payment_required", label: "Payment required" },
  { value: "payment_received", label: "Payment succeeded" },
];

export const BOOKING_TYPES = [
  { id: "bt_1", name: "Initial Consultation" },
  { id: "bt_2", name: "Water Heater Estimate" },
  { id: "bt_3", name: "Follow-up Visit" },
  { id: "bt_4", name: "Annual Checkup" },
];

function step(id: string, name: string, timing: WorkflowStepTiming, action: WorkflowAction, channel: WorkflowStep["channel"], messageTemplate: string): WorkflowStep {
  return { id, name, timing, action, channel, messageTemplate, enabled: true };
}

const rel = (anchor: any, amount: number, unit: any, direction: any): WorkflowStepTiming =>
  ({ kind: "relative", anchor, amount, unit, direction });

export const PREBUILT_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "standard_reminders",
    name: "Standard Reminders",
    description: "Confirmation on booking plus SMS reminders 24 hours and 2 hours before the appointment.",
    category: "Reminders",
    trigger: "appointment_booked",
    channels: ["sms"],
    recommended: true,
    steps: [
      step("s1", "Booking confirmation", { kind: "immediate" }, "send_sms_customer", "sms", "Hi {{first_name}}, you're booked for {{service}} on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm."),
      step("s2", "24-hour reminder", rel("appointment_start", 24, "hours", "before"), "send_sms_customer", "sms", "Reminder: {{service}} tomorrow at {{appointment_time}}. Need to change? {{reschedule_link}}"),
      step("s3", "2-hour reminder", rel("appointment_start", 2, "hours", "before"), "send_sms_customer", "sms", "See you soon — {{service}} at {{appointment_time}} today."),
    ],
  },
  {
    id: "confirmation_required",
    name: "Confirmation Required",
    description: "Asks the customer to confirm, follows up if they don't reply, and alerts your team when still unconfirmed.",
    category: "Confirmation",
    trigger: "appointment_booked",
    channels: ["sms"],
    steps: [
      step("s1", "Confirmation request", { kind: "immediate" }, "send_sms_customer", "sms", "Please confirm your {{service}} on {{appointment_date}} — reply YES to confirm or {{reschedule_link}} to reschedule."),
      step("s2", "Wait for reply", rel("booking_created", 5, "minutes", "after"), "wait_for_reply", "sms", ""),
      step("s3", "Unconfirmed follow-up", rel("appointment_start", 24, "hours", "before"), "send_sms_customer", "sms", "We haven't heard back — reply YES to keep your {{service}} appointment."),
      step("s4", "Alert team", rel("appointment_start", 6, "hours", "before"), "send_sms_team", "sms", "Heads up: {{first_name}} {{service}} at {{appointment_time}} is still unconfirmed."),
    ],
  },
  {
    id: "high_value_appointment",
    name: "High-Value Appointment",
    description: "Extra touchpoints for premium bookings: confirmation, 48-hour reminder, and a team notification.",
    category: "Reminders",
    trigger: "appointment_booked",
    channels: ["sms", "email"],
    steps: [
      step("s1", "Confirmation email", { kind: "immediate" }, "send_email_customer", "email", "Your {{service}} is confirmed for {{appointment_date}} at {{appointment_time}}."),
      step("s2", "48-hour reminder", rel("appointment_start", 48, "hours", "before"), "send_sms_customer", "sms", "Looking forward to your {{service}} on {{appointment_date}}."),
      step("s3", "Team heads-up", rel("appointment_start", 24, "hours", "before"), "send_sms_team", "sms", "High-value appointment tomorrow: {{first_name}}, {{service}} at {{appointment_time}}."),
    ],
  },
  {
    id: "last_minute_reminders",
    name: "Last-Minute Reminders",
    description: "For same-day and short-notice bookings — sends reminders within minutes of booking.",
    category: "Reminders",
    trigger: "appointment_booked",
    channels: ["sms"],
    steps: [
      step("s1", "Instant confirmation", { kind: "immediate" }, "send_sms_customer", "sms", "You're booked! {{service}} at {{appointment_time}} today."),
      step("s2", "1-hour reminder", rel("appointment_start", 1, "hours", "before"), "send_sms_customer", "sms", "{{service}} in one hour. See you soon!"),
      step("s3", "30-minute reminder", rel("appointment_start", 30, "minutes", "before"), "send_sms_customer", "sms", "30 minutes until your {{service}}."),
    ],
  },
  {
    id: "post_appointment_followup",
    name: "Post-Appointment Follow-Up",
    description: "Thanks the customer after their visit and opens the door to rebooking.",
    category: "Follow-up",
    trigger: "appointment_completed",
    channels: ["sms"],
    recommended: true,
    steps: [
      step("s1", "Thank-you message", rel("appointment_end", 2, "hours", "after"), "send_sms_customer", "sms", "Thanks for coming in today, {{first_name}}! Anything we can help with next?"),
      step("s2", "Rebook nudge", rel("appointment_end", 1, "days", "after"), "send_sms_customer", "sms", "Ready to book your next visit? {{booking_link}}"),
    ],
  },
  {
    id: "review_request",
    name: "Review Request",
    description: "Sends a review request a few hours after a completed appointment.",
    category: "Follow-up",
    trigger: "appointment_completed",
    channels: ["sms"],
    steps: [
      step("s1", "Review request", rel("appointment_end", 2, "hours", "after"), "request_review", "sms", "How was your visit, {{first_name}}? We'd love your feedback: {{review_link}}"),
    ],
  },
  {
    id: "reschedule_followup",
    name: "Reschedule Follow-Up",
    description: "When a customer reschedules, confirms the new time and resets reminders automatically.",
    category: "Reminders",
    trigger: "appointment_booked",
    channels: ["sms"],
    steps: [
      step("s1", "New time confirmed", { kind: "immediate" }, "send_sms_customer", "sms", "All set — your {{service}} has been moved to {{appointment_date}} at {{appointment_time}}."),
      step("s2", "24-hour reminder", rel("appointment_start", 24, "hours", "before"), "send_sms_customer", "sms", "Reminder: {{service}} tomorrow at {{appointment_time}}."),
    ],
  },
  {
    id: "no_show_recovery",
    name: "No-Show Recovery",
    description: "Reaches out after a missed appointment and offers an easy way to rebook.",
    category: "Follow-up",
    trigger: "appointment_no_show",
    channels: ["sms"],
    steps: [
      step("s1", "We missed you", rel("appointment_end", 2, "hours", "after"), "send_sms_customer", "sms", "We missed you today, {{first_name}}. Want to pick a new time? {{booking_link}}"),
      step("s2", "Second nudge", rel("appointment_end", 1, "days", "after"), "send_sms_customer", "sms", "Still happy to get you rescheduled — grab a time that works: {{booking_link}}"),
    ],
  },
  {
    id: "reengagement",
    name: "Re-Engagement / Book Again",
    description: "Reaches out to customers a week after their last visit to encourage rebooking.",
    category: "Follow-up",
    trigger: "appointment_completed",
    channels: ["sms"],
    steps: [
      step("s1", "Book again", rel("appointment_end", 7, "days", "after"), "send_sms_customer", "sms", "Hi {{first_name}}, it's been a week since your {{service}}. Ready to book again? {{booking_link}}"),
    ],
  },
  {
    id: "payment_followup",
    name: "Payment Follow-Up",
    description: "Sends a payment link when a balance is due and confirms when payment succeeds.",
    category: "Payments",
    trigger: "payment_required",
    channels: ["sms", "email"],
    steps: [
      step("s1", "Payment link", { kind: "immediate" }, "send_sms_customer", "sms", "Hi {{first_name}}, your balance for {{service}} is ready: {{payment_link}}"),
      step("s2", "Reminder", rel("booking_created", 1, "days", "after"), "send_email_customer", "email", "Friendly reminder — your payment for {{service}} is still outstanding: {{payment_link}}"),
    ],
  },
];

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

export const EXISTING_WORKFLOWS: AppointmentWorkflowRecord[] = [
  {
    id: "wf_1",
    name: "Standard Reminders",
    templateId: "standard_reminders",
    trigger: "appointment_booked",
    enabled: true,
    steps: getTemplate("standard_reminders")!.steps,
    updatedAt: "2026-09-04T14:12:00Z",
  },
  {
    id: "wf_2",
    name: "No-Show Recovery",
    templateId: "no_show_recovery",
    trigger: "appointment_no_show",
    enabled: true,
    steps: getTemplate("no_show_recovery")!.steps,
    updatedAt: "2026-08-28T09:40:00Z",
  },
];

export function newStep(index: number): WorkflowStep {
  return {
    id: `step_${Date.now()}_${index}`,
    name: `Step ${index + 1}`,
    timing: { kind: "immediate" },
    action: "send_sms_customer",
    channel: "sms",
    messageTemplate: "",
    enabled: true,
  };
}

export const MERGE_TAGS = [
  "{{first_name}}",
  "{{business_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{reschedule_link}}",
  "{{cancel_link}}",
  "{{booking_link}}",
  "{{payment_link}}",
  "{{review_link}}",
];
