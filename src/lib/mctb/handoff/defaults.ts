import type {
  MctbHandoffConfigDto,
  MctbLeadFieldConfig,
  MctbRoutingMatrix,
} from "./types";

export const DEFAULT_LEAD_FIELD_SCHEMA: MctbLeadFieldConfig[] = [
  { id: "caller_name", label: "Caller name", requirement: "optional", sortOrder: 1 },
  { id: "service_reason", label: "Service or reason", requirement: "required", sortOrder: 2 },
  { id: "urgency", label: "Urgency", requirement: "optional", sortOrder: 3 },
  { id: "location_zip", label: "Location / ZIP", requirement: "optional", sortOrder: 4 },
  { id: "service_address", label: "Service address", requirement: "off", sortOrder: 5 },
  { id: "callback_time", label: "Preferred callback time", requirement: "optional", sortOrder: 6 },
  { id: "customer_type", label: "New or existing customer", requirement: "off", sortOrder: 7 },
  { id: "appointment_intent", label: "Appointment interest", requirement: "off", sortOrder: 8 },
  { id: "additional_details", label: "Additional details", requirement: "optional", sortOrder: 9 },
];

export const DEFAULT_ROUTING_MATRIX: MctbRoutingMatrix = {
  caller_replied: { channels: { sms: true, in_app: true }, recipientIds: [] },
  lead_captured: { channels: { sms: true, email: true, in_app: true }, recipientIds: [] },
  callback_requested: { channels: { sms: true, email: true, in_app: true }, recipientIds: [] },
  urgent_detected: { channels: { sms: true, email: true, in_app: true }, recipientIds: [] },
  human_required: { channels: { sms: true, email: true, in_app: true }, recipientIds: [] },
  appointment_booked: { channels: { email: true, in_app: true }, recipientIds: [] },
};

export function defaultHandoffConfig(): MctbHandoffConfigDto {
  return {
    responseMode: "ai_conversation",
    emergencyDetectionEnabled: false,
    emergencyCriteria: null,
    emergencyAction: "notify_only",
    emergencyUncertainBehavior: "handoff_human",
    bookingBehavior: "off",
    fieldSchema: DEFAULT_LEAD_FIELD_SCHEMA,
    routingMatrix: DEFAULT_ROUTING_MATRIX,
    quietHours: {
      enabled: false,
      start: null,
      end: null,
      emergencyBypass: true,
      nonUrgentSmsDelay: false,
    },
  };
}

export const RESPONSE_MODE_LABELS: Record<string, { title: string; subtitle: string }> = {
  notify_only: {
    title: "Notify me after they reply",
    subtitle: "Save the message and alert your team — no automated follow-up texts.",
  },
  guided_collection: {
    title: "Collect information",
    subtitle: "Ask a short configured question set, then send a lead summary.",
  },
  ai_conversation: {
    title: "AI text conversation",
    subtitle: "Let Transovo continue the SMS thread within your configured scope.",
  },
  immediate_handoff: {
    title: "Hand off immediately",
    subtitle: "Alert your team on the first reply and stop automation.",
  },
};
