export type StepTiming =
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
  timing: StepTiming;
  action: string;
  channel: "sms" | "email" | "voice";
  messageTemplate: string;
  voiceReminderTemplateId?: string;
  stopIfConfirmed?: boolean;
  enabled: boolean;
};

export type WorkflowCondition = {
  id: string;
  operator: string;
  value?: string;
};

export const TRIGGERS: Array<{ value: string; label: string; group: string }> = [
  { value: "appointment_booked", label: "Appointment booked", group: "Appointment" },
  { value: "appointment_confirmed", label: "Appointment confirmed", group: "Appointment" },
  { value: "appointment_rescheduled", label: "Appointment rescheduled", group: "Appointment" },
  { value: "appointment_canceled", label: "Appointment canceled", group: "Appointment" },
  { value: "appointment_completed", label: "Appointment completed", group: "Appointment" },
  { value: "appointment_no_show", label: "No-show", group: "Appointment" },
  { value: "appointment_status_changed", label: "Status changed", group: "Appointment" },
  { value: "before_appointment", label: "Before appointment", group: "Appointment" },
  { value: "after_appointment", label: "After appointment", group: "Appointment" },
  { value: "booking_requested", label: "Booking requested", group: "Booking" },
  { value: "booking_approved", label: "Booking approved", group: "Booking" },
  { value: "booking_rejected", label: "Booking rejected", group: "Booking" },
  { value: "payment_received", label: "Payment succeeded", group: "Payments" },
  { value: "payment_required", label: "Payment required", group: "Payments" },
  { value: "payment_failed", label: "Payment failed", group: "Payments" },
  { value: "deposit_paid", label: "Deposit paid", group: "Payments" },
  { value: "balance_due", label: "Balance due", group: "Payments" },
  { value: "waitlist_slot_available", label: "Waitlist slot available", group: "Waitlist" },
  { value: "meeting_completed", label: "Meeting completed", group: "Meetings" },
  { value: "meeting_recap_ready", label: "Meeting recap ready", group: "Meetings" },
];

export function triggerLabel(value: string): string {
  return TRIGGERS.find((t) => t.value === value)?.label ?? value;
}

export const ACTIONS: Array<{ value: string; label: string }> = [
  { value: "send_sms_customer", label: "Send SMS to customer" },
  { value: "send_email_customer", label: "Send email to customer" },
  { value: "send_voice_reminder", label: "Place voice reminder call" },
  { value: "send_sms_staff", label: "Send SMS to staff" },
  { value: "send_email_staff", label: "Send email to staff" },
  { value: "request_confirmation", label: "Request confirmation" },
  { value: "request_review", label: "Request review" },
  { value: "offer_waitlist_slot", label: "Offer waitlist slot" },
  { value: "update_status", label: "Update appointment status" },
];

export const TIMING_PRESETS: Array<{ label: string; timing: StepTiming }> = [
  { label: "Immediately", timing: { kind: "immediate" } },
  { label: "1 minute after booking", timing: { kind: "relative", anchor: "booking_created", amount: 1, unit: "minutes", direction: "after" } },
  { label: "5 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 5, unit: "minutes", direction: "after" } },
  { label: "10 minutes after booking", timing: { kind: "relative", anchor: "booking_created", amount: 10, unit: "minutes", direction: "after" } },
  { label: "7 days before", timing: { kind: "relative", anchor: "appointment_start", amount: 7, unit: "days", direction: "before" } },
  { label: "48 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 48, unit: "hours", direction: "before" } },
  { label: "24 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" } },
  { label: "6 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 6, unit: "hours", direction: "before" } },
  { label: "2 hours before", timing: { kind: "relative", anchor: "appointment_start", amount: 2, unit: "hours", direction: "before" } },
  { label: "1 hour before", timing: { kind: "relative", anchor: "appointment_start", amount: 1, unit: "hours", direction: "before" } },
  { label: "30 minutes before", timing: { kind: "relative", anchor: "appointment_start", amount: 30, unit: "minutes", direction: "before" } },
  { label: "2 hours after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 2, unit: "hours", direction: "after" } },
  { label: "1 day after appointment end", timing: { kind: "relative", anchor: "appointment_end", amount: 1, unit: "days", direction: "after" } },
];

export function describeTiming(t: StepTiming): string {
  const preset = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(t));
  if (preset) return preset.label;
  if (t.kind === "immediate") return "Immediately";
  const anchor =
    t.anchor === "appointment_end" ? "appointment end" : t.anchor === "booking_created" ? "booking created" : "appointment start";
  return `${t.amount} ${t.unit} ${t.direction} ${anchor}`;
}

export function timingPresetValue(t: StepTiming): string {
  const match = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(t));
  return match ? JSON.stringify(match.timing) : "__custom__";
}

export const APPOINTMENT_TYPES = [
  { id: "type_1", name: "Initial Consultation" },
  { id: "type_2", name: "Water Heater Estimate" },
  { id: "type_3", name: "Follow-Up Visit" },
  { id: "type_4", name: "Annual Inspection" },
];

export const VOICE_TEMPLATES = [
  {
    id: "standard_appointment_reminder",
    name: "Standard Appointment Reminder",
    keypad: "1 = Confirm appointment · 2 = Reschedule · 3 = Cancel appointment · 4 = Speak with us",
  },
  {
    id: "confirm_only",
    name: "Confirm Only",
    keypad: "1 = Confirm appointment",
  },
];

export const MERGE_TAGS = [
  "{{first_name}}",
  "{{business_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{reschedule_link}}",
  "{{cancel_link}}",
];

export const CONDITION_OPTIONS: Array<{ value: string; label: string; needsValue?: "status" | "type" | "initiated_by" }> = [
  { value: "is_confirmed", label: "Appointment is confirmed" },
  { value: "not_confirmed", label: "Appointment is not confirmed" },
  { value: "is_canceled", label: "Appointment is canceled" },
  { value: "is_no_show", label: "Appointment is a no-show" },
  { value: "has_phone", label: "Customer has a phone number" },
  { value: "has_email", label: "Customer has an email address" },
  { value: "has_sms_consent", label: "Customer has SMS consent" },
  { value: "is_upcoming", label: "Appointment is upcoming" },
  { value: "was_rescheduled", label: "Appointment was rescheduled" },
  { value: "appointment_type_equals", label: "Booking type is", needsValue: "type" },
  { value: "appointment_type_not_equals", label: "Booking type is not", needsValue: "type" },
  { value: "deposit_paid", label: "Deposit paid, balance remaining" },
  { value: "balance_due", label: "Balance is due" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "customer_has_future_appointment", label: "Customer has a future appointment" },
  { value: "customer_no_future_appointment", label: "Customer has no future appointment" },
  { value: "change_initiated_by_equals", label: "Change was initiated by", needsValue: "initiated_by" },
  { value: "is_recurring", label: "Part of a recurring series" },
  { value: "is_first_recurring_occurrence", label: "First occurrence of a recurring series" },
];

export const INITIATED_BY_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "staff", label: "Staff" },
  { value: "system", label: "System" },
];

export function conditionLabel(c: WorkflowCondition): string {
  const opt = CONDITION_OPTIONS.find((o) => o.value === c.operator);
  if (!opt) return c.operator;
  if (opt.needsValue === "type") {
    const t = APPOINTMENT_TYPES.find((x) => x.id === c.value);
    return `${opt.label} ${t?.name ?? "…"}`;
  }
  if (opt.needsValue === "initiated_by") {
    const v = INITIATED_BY_OPTIONS.find((x) => x.value === c.value);
    return `${opt.label} ${v?.label ?? "…"}`;
  }
  return opt.label;
}

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: Omit<WorkflowStep, "id">[];
};

export const PREBUILT_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "standard_reminders",
    name: "Standard Reminders",
    description: "Confirmation on booking plus 24-hour and 2-hour SMS reminders.",
    trigger: "appointment_booked",
    steps: [
      { name: "Booking confirmation", timing: { kind: "immediate" }, action: "send_sms_customer", channel: "sms", messageTemplate: "Hi {{first_name}}, your {{service}} appointment is booked for {{appointment_date}} at {{appointment_time}}.", enabled: true },
      { name: "24-hour reminder", timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" }, action: "send_sms_customer", channel: "sms", messageTemplate: "Reminder: {{service}} tomorrow at {{appointment_time}}. Reply YES to confirm.", stopIfConfirmed: true, enabled: true },
      { name: "2-hour reminder", timing: { kind: "relative", anchor: "appointment_start", amount: 2, unit: "hours", direction: "before" }, action: "send_sms_customer", channel: "sms", messageTemplate: "See you soon! {{service}} at {{appointment_time}} today.", stopIfConfirmed: true, enabled: true },
    ],
  },
  {
    id: "confirmation_required",
    name: "Confirmation Required",
    description: "Ask customers to confirm and follow up if they don't respond.",
    trigger: "appointment_booked",
    steps: [
      { name: "Confirmation request", timing: { kind: "immediate" }, action: "request_confirmation", channel: "sms", messageTemplate: "Please confirm your {{service}} on {{appointment_date}}. Reply YES to confirm or {{reschedule_link}} to reschedule.", enabled: true },
      { name: "Follow-up if unconfirmed", timing: { kind: "relative", anchor: "appointment_start", amount: 24, unit: "hours", direction: "before" }, action: "send_sms_customer", channel: "sms", messageTemplate: "We haven't heard back — please confirm {{service}} at {{appointment_time}}.", stopIfConfirmed: true, enabled: true },
    ],
  },
  {
    id: "no_show_recovery",
    name: "No-Show Recovery",
    description: "Follow up after a missed appointment and invite the customer to rebook.",
    trigger: "appointment_no_show",
    steps: [
      { name: "No-show follow-up", timing: { kind: "immediate" }, action: "send_sms_customer", channel: "sms", messageTemplate: "Hi {{first_name}}, we missed you at your {{service}} appointment. Reply here or use {{reschedule_link}} to pick a new time.", enabled: true },
      { name: "Staff alert", timing: { kind: "immediate" }, action: "send_sms_staff", channel: "sms", messageTemplate: "{{first_name}} did not show for {{service}} at {{appointment_time}}.", enabled: true },
    ],
  },
  {
    id: "review_request",
    name: "Review Request",
    description: "Ask for a review after the appointment is completed.",
    trigger: "appointment_completed",
    steps: [
      { name: "Review request", timing: { kind: "relative", anchor: "appointment_end", amount: 2, unit: "hours", direction: "after" }, action: "request_review", channel: "sms", messageTemplate: "Thanks for visiting {{business_name}}! How was your {{service}}? We'd love your feedback.", enabled: true },
    ],
  },
];

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return PREBUILT_TEMPLATES.find((t) => t.id === id);
}
