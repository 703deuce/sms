import type {
  AppointmentWorkflowRecord,
  AppointmentWorkflowStep,
  PrebuiltWorkflowTemplateId,
} from "./types";

export type PrebuiltWorkflowTemplate = {
  id: PrebuiltWorkflowTemplateId;
  name: string;
  description: string;
  channels: Array<"sms" | "email">;
  trigger: AppointmentWorkflowRecord["trigger"];
  defaultSteps: AppointmentWorkflowStep[];
};

const DEFAULT_CONFIRMATION =
  "Hi {{first_name}}, your {{service}} appointment is booked for {{appointment_date}} at {{appointment_time}}. Reply YES to confirm or use {{reschedule_link}} to reschedule.";

const DEFAULT_REMINDER =
  "Reminder: {{service}} on {{appointment_date}} at {{appointment_time}} with {{business_name}}. {{confirm_link}}";

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
    channels: ["sms"],
    trigger: "appointment_completed",
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
    channels: ["sms"],
    trigger: "appointment_completed",
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
];

export function getPrebuiltTemplate(id: string): PrebuiltWorkflowTemplate | null {
  return PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === id) ?? null;
}
