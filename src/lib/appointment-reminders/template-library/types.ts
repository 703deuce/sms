export type TemplateLibraryChannel = "sms" | "email";

export type TemplateMessageType =
  | "booking_confirmation"
  | "advance_reminder"
  | "day_before"
  | "same_day"
  | "confirmation_request"
  | "reschedule_notice"
  | "cancellation_notice"
  | "preparation"
  | "follow_up";

export type TemplateLibraryEntry = {
  id: string;
  industry: string;
  messageType: TemplateMessageType;
  channel: TemplateLibraryChannel;
  label: string;
  subject: string | null;
  body: string;
};

export type TemplateLibraryCatalog = {
  version: number;
  generatedAt: string;
  messageTypes: TemplateMessageType[];
  industries: string[];
  templates: TemplateLibraryEntry[];
};

/** Default mapping from scheduler step → library message type. */
export const STEP_TO_MESSAGE_TYPE: Record<string, TemplateMessageType> = {
  confirmation: "booking_confirmation",
  reminder24h: "advance_reminder",
  reminder2h: "same_day",
};

export const MESSAGE_TYPE_LABELS: Record<TemplateMessageType, string> = {
  booking_confirmation: "Booking confirmation",
  advance_reminder: "Advance reminder",
  day_before: "Day before",
  same_day: "Same day",
  confirmation_request: "Confirmation request",
  reschedule_notice: "Reschedule notice",
  cancellation_notice: "Cancellation notice",
  preparation: "Preparation instructions",
  follow_up: "Follow-up (requires consent)",
};

export const INDUSTRY_LABELS: Record<string, string> = {
  general: "General appointments",
  dental: "Dental",
  healthcare: "Healthcare",
  salon_spa: "Salon & spa",
  legal: "Legal",
  financial: "Financial services",
  real_estate: "Real estate",
  counseling: "Counseling & wellness",
  massage: "Massage therapy",
  fitness: "Fitness & personal training",
  education: "Education",
  tattoo: "Tattoo studios",
  photography: "Photography",
  government: "Government services",
  automotive: "Automotive",
  home_services: "Home services",
  veterinary: "Veterinary",
};
