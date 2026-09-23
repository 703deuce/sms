import type { MctbRequestFormField } from "@/lib/mctb/request-form-shared";

export type MctbRecoveryGoalId =
  | "get_reply"
  | "request_callback"
  | "collect_details"
  | "book_appointment";

export type MctbRecoveryGoalDefinition = {
  id: MctbRecoveryGoalId;
  title: string;
  description: string;
  defaultOpener: string;
  requestFormPreset: MctbRequestFormField[];
  usesBookingLink: boolean;
};

export const MCTB_RECOVERY_GOALS: MctbRecoveryGoalDefinition[] = [
  {
    id: "get_reply",
    title: "Get a reply",
    description: "Ask why they called with a short, controlled recovery opener.",
    defaultOpener:
      "Hi {{customer.firstName}}, sorry we missed your call to {{business.name}}. What can we help you with today?",
    requestFormPreset: [],
    usesBookingLink: false,
  },
  {
    id: "request_callback",
    title: "Request a callback",
    description: "Collect details so your team can call them back.",
    defaultOpener:
      "Hi {{customer.firstName}}, sorry we missed you at {{business.name}}. Reply with the best number and time to call you back.",
    requestFormPreset: [
      { id: "name", type: "text", label: "Name", required: true },
      { id: "phone", type: "phone", label: "Phone", required: true },
      {
        id: "callback_time",
        type: "textarea",
        label: "Best time / callback details",
        required: false,
      },
      {
        id: "help",
        type: "textarea",
        label: "What can we help with?",
        required: false,
      },
    ],
    usesBookingLink: false,
  },
  {
    id: "collect_details",
    title: "Collect details",
    description: "Send your request form link and gather structured information.",
    defaultOpener:
      "Hi {{customer.firstName}}, sorry we missed your call to {{business.name}}. Share a few details here: {{link}}",
    requestFormPreset: [
      { id: "name", type: "text", label: "Name", required: true },
      { id: "phone", type: "phone", label: "Phone", required: true },
      { id: "email", type: "email", label: "Email", required: false },
      {
        id: "need",
        type: "textarea",
        label: "What do you need help with?",
        required: true,
      },
    ],
    usesBookingLink: false,
  },
  {
    id: "book_appointment",
    title: "Book an appointment",
    description: "Send your configured booking link — no conversational scheduling.",
    defaultOpener:
      "Hi {{customer.firstName}}, sorry we missed you at {{business.name}}. Book a time that works for you: {{link}}",
    requestFormPreset: [
      { id: "name", type: "text", label: "Name", required: true },
      { id: "phone", type: "phone", label: "Phone", required: true },
      {
        id: "appointment_notes",
        type: "textarea",
        label: "Anything we should know?",
        required: false,
      },
    ],
    usesBookingLink: true,
  },
];

export function getRecoveryGoalDefinition(id: MctbRecoveryGoalId): MctbRecoveryGoalDefinition {
  return MCTB_RECOVERY_GOALS.find((g) => g.id === id) ?? MCTB_RECOVERY_GOALS[0];
}

export function parseRecoveryGoalId(raw: unknown): MctbRecoveryGoalId | null {
  if (typeof raw !== "string") return null;
  return MCTB_RECOVERY_GOALS.some((g) => g.id === raw) ? (raw as MctbRecoveryGoalId) : null;
}
