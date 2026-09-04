/**
 * Appointment workflow domain types — isolated from SMS DripCampaign / Playbooks.
 */

export const APPOINTMENT_WORKFLOW_TRIGGERS = [
  "appointment_booked",
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_canceled",
  "appointment_completed",
  "appointment_no_show",
  "appointment_status_changed",
  "before_appointment",
  "after_appointment",
  "booking_requested",
  "booking_approved",
  "booking_rejected",
  "payment_received",
  "payment_failed",
  "deposit_paid",
  "balance_due",
  "waitlist_slot_available",
] as const;

export type AppointmentWorkflowTrigger = (typeof APPOINTMENT_WORKFLOW_TRIGGERS)[number];

export const APPOINTMENT_WORKFLOW_CHANNELS = ["sms", "email", "both"] as const;
export type AppointmentWorkflowChannel = (typeof APPOINTMENT_WORKFLOW_CHANNELS)[number];

export type RelativeTimeAnchor = "appointment_start" | "appointment_end" | "booking_created";

export type RelativeTimeUnit = "minutes" | "hours" | "days";

export type WorkflowRelativeTiming = {
  kind: "relative";
  anchor: RelativeTimeAnchor;
  amount: number;
  unit: RelativeTimeUnit;
  /** negative = before anchor, positive = after anchor */
  direction: "before" | "after";
};

export type WorkflowImmediateTiming = { kind: "immediate" };

export type WorkflowStepTiming = WorkflowRelativeTiming | WorkflowImmediateTiming;

export type WorkflowConditionOperator =
  | "equals"
  | "not_equals"
  | "is_confirmed"
  | "not_confirmed"
  | "is_canceled"
  | "not_canceled"
  | "is_completed"
  | "not_completed"
  | "is_no_show"
  | "not_no_show"
  | "has_phone"
  | "has_email"
  | "has_sms_consent"
  | "reminder_sent"
  | "reminder_not_sent"
  | "is_upcoming"
  | "was_rescheduled"
  | "appointment_type_equals"
  | "appointment_type_not_equals"
  | "payment_status_equals"
  | "deposit_paid"
  | "balance_due"
  | "payment_failed";

export type WorkflowCondition = {
  id: string;
  field: string;
  operator: WorkflowConditionOperator;
  value?: string | boolean | number;
};

export type WorkflowConditionGroup = {
  logic: "and" | "or";
  conditions: WorkflowCondition[];
};

export type WorkflowStepAction =
  | "send_sms_customer"
  | "send_email_customer"
  | "send_sms_staff"
  | "send_email_staff"
  | "mark_confirmed"
  | "update_status"
  | "send_confirm_link"
  | "send_reschedule_link"
  | "send_cancel_link"
  | "send_review_link"
  | "stop_workflow";

export type AppointmentWorkflowStep = {
  id: string;
  name: string;
  timing: WorkflowStepTiming;
  action: WorkflowStepAction;
  channel?: AppointmentWorkflowChannel;
  messageTemplate?: string;
  /** Designated staff recipient for staff notification actions */
  recipientStaffId?: string;
  /** Stop confirmation-chasing steps once confirmed */
  stopIfConfirmed?: boolean;
  enabled?: boolean;
};

export type AppointmentTypeScope = {
  mode: "all" | "selected";
  typeIds?: string[];
};

export type AppointmentWorkflowRecord = {
  id: string;
  workspaceId: string;
  name: string;
  sourceType: "template" | "custom";
  templateId: string | null;
  active: boolean;
  status: "active" | "paused" | "draft";
  trigger: AppointmentWorkflowTrigger;
  appointmentTypeScope: AppointmentTypeScope;
  channels: AppointmentWorkflowChannel[];
  conditions: WorkflowConditionGroup | null;
  steps: AppointmentWorkflowStep[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentWorkflowExecutionStatus =
  | "active"
  | "completed"
  | "invalidated"
  | "canceled";

export type StepExecutionState = "scheduled" | "sent" | "failed" | "skipped" | "canceled";

export const PREBUILT_WORKFLOW_TEMPLATE_IDS = [
  "standard_reminders",
  "confirmation_required",
  "high_value_appointment",
  "last_minute_reminders",
  "post_appointment_follow_up",
  "review_request",
  "reschedule_follow_up",
] as const;

export type PrebuiltWorkflowTemplateId = (typeof PREBUILT_WORKFLOW_TEMPLATE_IDS)[number];

export function parseWorkflowSteps(raw: unknown): AppointmentWorkflowStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const timing = o.timing as WorkflowStepTiming | undefined;
      const action = String(o.action || "send_sms_customer") as WorkflowStepAction;
      if (!timing) return null;
      return {
        id: typeof o.id === "string" ? o.id : `step_${index + 1}`,
        name: typeof o.name === "string" ? o.name : `Step ${index + 1}`,
        timing,
        action,
        channel: o.channel as AppointmentWorkflowChannel | undefined,
        messageTemplate: typeof o.messageTemplate === "string" ? o.messageTemplate : undefined,
        recipientStaffId: typeof o.recipientStaffId === "string" ? o.recipientStaffId : undefined,
        stopIfConfirmed: o.stopIfConfirmed === true,
        enabled: o.enabled !== false,
      };
    })
    .filter(Boolean) as AppointmentWorkflowStep[];
}

export function parseAppointmentTypeScope(raw: unknown): AppointmentTypeScope {
  if (!raw || typeof raw !== "object") return { mode: "all" };
  const o = raw as Record<string, unknown>;
  return {
    mode: o.mode === "selected" ? "selected" : "all",
    typeIds: Array.isArray(o.typeIds)
      ? o.typeIds.filter((id): id is string => typeof id === "string")
      : undefined,
  };
}
