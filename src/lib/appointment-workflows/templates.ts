import type {
  AppointmentWorkflowRecord,
  AppointmentWorkflowStep,
  PrebuiltWorkflowTemplateId,
  WorkflowConditionGroup,
} from "./types";

export type PrebuiltWorkflowTemplate = {
  id: PrebuiltWorkflowTemplateId;
  name: string;
  description: string;
  category?: "reminders" | "follow_up" | "recovery" | "payments";
  channels: Array<"sms" | "email">;
  trigger: AppointmentWorkflowRecord["trigger"];
  defaultConditions?: WorkflowConditionGroup | null;
  defaultSteps: AppointmentWorkflowStep[];
};

const DEFAULT_CONFIRMATION =
  "Hi {{first_name}}, your {{service}} appointment is booked for {{appointment_date}} at {{appointment_time}}. Manage: {{manage_link}} Reply YES to confirm.";

const DEFAULT_REMINDER =
  "Reminder: {{service}} on {{appointment_date}} at {{appointment_time}} with {{business_name}}. Manage: {{manage_link}}";

export const PREBUILT_WORKFLOW_TEMPLATES: PrebuiltWorkflowTemplate[] = [
  {
    id: "standard_reminders",
    name: "Standard Reminders",
    description: "Confirmation plus 24-hour and 2-hour reminders.",
    channels: ["sms"],
    trigger: "appointment_booked",
    defaultSteps: [
      {
        id: "confirm",
        name: "Send confirmation",
        timing: { kind: "immediate" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_CONFIRMATION,
      },
      {
        id: "reminder_24h",
        name: "24 hours before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 24,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
      {
        id: "reminder_2h",
        name: "2 hours before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 2,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
    ],
  },
  {
    id: "confirmation_required",
    name: "Confirmation Required",
    description: "Chase confirmation until confirmed, then send reminders.",
    channels: ["sms"],
    trigger: "appointment_booked",
    defaultSteps: [
      {
        id: "confirm_request",
        name: "Confirmation request",
        timing: { kind: "immediate" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "Please confirm your {{service}} on {{appointment_date}} at {{appointment_time}}: {{confirm_link}}",
        stopIfConfirmed: true,
      },
      {
        id: "confirm_chase_48h",
        name: "48h confirmation reminder",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 48,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: "Still need your confirmation for {{appointment_date}}: {{confirm_link}}",
        stopIfConfirmed: true,
      },
      {
        id: "reminder_24h",
        name: "24 hours before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 24,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
    ],
  },
  {
    id: "high_value_appointment",
    name: "High-Value Appointment",
    description: "Extra touchpoints for high-value bookings.",
    channels: ["sms", "email"],
    trigger: "appointment_booked",
    defaultSteps: [
      {
        id: "confirm",
        name: "Booking confirmation",
        timing: { kind: "immediate" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_CONFIRMATION,
      },
      {
        id: "reminder_7d",
        name: "7 days before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 7,
          unit: "days",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
      {
        id: "reminder_48h",
        name: "48 hours before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 48,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
      {
        id: "reminder_2h",
        name: "2 hours before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 2,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
      {
        id: "staff_alert",
        name: "Staff notification",
        timing: { kind: "immediate" },
        action: "send_sms_staff",
        channel: "sms",
        messageTemplate:
          "High-value booking: {{first_name}} — {{service}} on {{appointment_date}} at {{appointment_time}}.",
      },
    ],
  },
  {
    id: "last_minute_reminders",
    name: "Last-Minute Reminders",
    description: "6-hour and 1-hour reminders.",
    channels: ["sms"],
    trigger: "appointment_booked",
    defaultSteps: [
      {
        id: "reminder_6h",
        name: "6 hours before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 6,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
      {
        id: "reminder_1h",
        name: "1 hour before",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 1,
          unit: "hours",
          direction: "before",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: DEFAULT_REMINDER,
      },
    ],
  },
  {
    id: "post_appointment_follow_up",
    name: "Post-Appointment Follow-Up",
    description: "Thank-you message after completion.",
    category: "follow_up",
    channels: ["sms"],
    trigger: "appointment_completed",
    defaultConditions: {
      logic: "and",
      conditions: [
        { id: "completed", field: "status", operator: "is_completed", value: true },
        { id: "not_no_show", field: "status", operator: "not_no_show", value: true },
      ],
    },
    defaultSteps: [
      {
        id: "thank_you",
        name: "Thank you",
        timing: {
          kind: "relative",
          anchor: "appointment_end",
          amount: 2,
          unit: "hours",
          direction: "after",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "Thanks for visiting {{business_name}} today, {{first_name}}! Let us know if you need anything else.",
      },
    ],
  },
  {
    id: "review_request",
    name: "Review Request",
    description: "Ask for a review after the appointment.",
    category: "follow_up",
    channels: ["sms"],
    trigger: "appointment_completed",
    defaultConditions: {
      logic: "and",
      conditions: [
        { id: "completed", field: "status", operator: "is_completed", value: true },
        { id: "not_no_show", field: "status", operator: "not_no_show", value: true },
        { id: "not_canceled", field: "status", operator: "not_canceled", value: true },
      ],
    },
    defaultSteps: [
      {
        id: "review",
        name: "Review request",
        timing: {
          kind: "relative",
          anchor: "appointment_end",
          amount: 1,
          unit: "days",
          direction: "after",
        },
        action: "send_review_link",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, we'd love your feedback on your recent visit. {{review_link}}",
      },
    ],
  },
  {
    id: "reschedule_follow_up",
    name: "Reschedule Follow-Up",
    description: "Send updated confirmation after reschedule.",
    channels: ["sms"],
    trigger: "appointment_rescheduled",
    defaultSteps: [
      {
        id: "reschedule_confirm",
        name: "Updated confirmation",
        timing: { kind: "immediate" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "Your appointment has been moved to {{appointment_date}} at {{appointment_time}}. {{confirm_link}}",
      },
    ],
  },
  {
    id: "no_show_recovery",
    name: "No-Show Recovery",
    description: "Reach out after a missed appointment and offer to reschedule.",
    category: "recovery",
    channels: ["sms"],
    trigger: "appointment_no_show",
    defaultConditions: {
      logic: "and",
      conditions: [{ id: "no_show", field: "status", operator: "is_no_show", value: true }],
    },
    defaultSteps: [
      {
        id: "no_show_immediate",
        name: "Missed appointment message",
        timing: { kind: "immediate" },
        action: "send_reschedule_link",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, we missed you today for {{service}}. Would you like to reschedule? {{manage_link}}",
      },
      {
        id: "no_show_followup",
        name: "Next-day follow-up",
        timing: {
          kind: "relative",
          anchor: "appointment_start",
          amount: 1,
          unit: "days",
          direction: "after",
        },
        action: "send_reschedule_link",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, still hoping to get you rescheduled for {{service}}. {{manage_link}}",
        stopIfRebooked: true,
      },
      {
        id: "no_show_staff",
        name: "Staff no-show alert",
        timing: { kind: "immediate" },
        action: "send_sms_staff",
        channel: "sms",
        messageTemplate:
          "No-show: {{first_name}} for {{service}} on {{appointment_date}} at {{appointment_time}}.",
      },
    ],
  },
  {
    id: "re_engagement",
    name: "Re-Engagement / Book Again",
    description: "Invite completed customers back when they have no upcoming appointment.",
    category: "follow_up",
    channels: ["sms"],
    trigger: "appointment_completed",
    defaultConditions: {
      logic: "and",
      conditions: [
        { id: "completed", field: "status", operator: "is_completed", value: true },
        { id: "no_future", field: "customer", operator: "customer_no_future_appointment", value: true },
      ],
    },
    defaultSteps: [
      {
        id: "rebook_30d",
        name: "30 days after visit",
        timing: {
          kind: "relative",
          anchor: "appointment_end",
          amount: 30,
          unit: "days",
          direction: "after",
        },
        action: "send_booking_link",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, ready to book your next {{service}} with {{business_name}}? {{booking_link}}",
        stopIfRebooked: true,
      },
      {
        id: "rebook_60d",
        name: "60 days after visit",
        timing: {
          kind: "relative",
          anchor: "appointment_end",
          amount: 60,
          unit: "days",
          direction: "after",
        },
        action: "send_booking_link",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, we'd love to see you again. Book your next appointment: {{booking_link}}",
        stopIfRebooked: true,
      },
    ],
  },
  {
    id: "payment_follow_up",
    name: "Payment Follow-Up",
    description: "Remind customers to complete outstanding appointment payments.",
    category: "payments",
    channels: ["sms"],
    trigger: "payment_required",
    defaultConditions: null,
    defaultSteps: [
      {
        id: "payment_reminder",
        name: "Payment reminder",
        timing: {
          kind: "relative",
          anchor: "booking_created",
          amount: 1,
          unit: "hours",
          direction: "after",
        },
        action: "send_payment_link",
        channel: "sms",
        messageTemplate:
          "Hi {{first_name}}, please complete payment for your {{service}} appointment: {{payment_link}}",
        stopIfPaid: true,
      },
    ],
  },
  {
    id: "rapid_flow_test",
    name: "Rapid Flow Test (minutes)",
    description:
      "For certification: immediate + 1/3/5 minute steps after booking to verify multi-step workflows.",
    category: "reminders",
    channels: ["sms"],
    trigger: "appointment_booked",
    defaultSteps: [
      {
        id: "step_immediate",
        name: "Step 1 — immediate",
        timing: { kind: "immediate" },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate:
          "[WF-1] Hi {{first_name}}, your {{service}} is booked for {{appointment_date}} at {{appointment_time}}.",
      },
      {
        id: "step_1min",
        name: "Step 2 — 1 min after booking",
        timing: {
          kind: "relative",
          anchor: "booking_created",
          amount: 1,
          unit: "minutes",
          direction: "after",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: "[WF-2] Quick check-in — your appointment is still on for {{appointment_time}}.",
      },
      {
        id: "step_3min",
        name: "Step 3 — 3 min after booking",
        timing: {
          kind: "relative",
          anchor: "booking_created",
          amount: 3,
          unit: "minutes",
          direction: "after",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: "[WF-3] Reminder: {{service}} with {{business_name}} on {{appointment_date}}.",
      },
      {
        id: "step_5min",
        name: "Step 4 — 5 min after booking",
        timing: {
          kind: "relative",
          anchor: "booking_created",
          amount: 5,
          unit: "minutes",
          direction: "after",
        },
        action: "send_sms_customer",
        channel: "sms",
        messageTemplate: "[WF-4] Final test ping — reply STOP to opt out.",
      },
    ],
  },
];

export function getPrebuiltTemplate(id: string): PrebuiltWorkflowTemplate | null {
  return PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === id) ?? null;
}
