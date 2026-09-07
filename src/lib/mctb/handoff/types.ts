/** MCTB Lead Handoff & Notifications — canonical domain types */

export const MCTB_RESPONSE_MODES = [
  "notify_only",
  "guided_collection",
  "ai_conversation",
  "immediate_handoff",
] as const;

export type MctbResponseMode = (typeof MCTB_RESPONSE_MODES)[number];

export const MCTB_HANDOFF_EVENT_TYPES = [
  "missed_call_detected",
  "caller_replied",
  "lead_captured",
  "callback_requested",
  "urgent_detected",
  "human_required",
  "appointment_booked",
  "voicemail_received",
  "recovery_failure",
] as const;

export type MctbHandoffEventType = (typeof MCTB_HANDOFF_EVENT_TYPES)[number];

export const MCTB_AUTOMATION_STATES = [
  "waiting_for_caller",
  "automation_active",
  "collecting_information",
  "waiting_for_customer",
  "needs_human",
  "human_active",
  "callback_requested",
  "urgent",
  "appointment_offered",
  "appointment_booked",
  "resolved",
] as const;

export type MctbAutomationState = (typeof MCTB_AUTOMATION_STATES)[number];

export const MCTB_FOLLOW_UP_STATUSES = [
  "needs_follow_up",
  "acknowledged",
  "called_back",
  "resolved",
  "appointment_booked",
] as const;

export type MctbFollowUpStatus = (typeof MCTB_FOLLOW_UP_STATUSES)[number];

export const MCTB_EMERGENCY_ACTIONS = [
  "notify_only",
  "callback_request",
  "notify_emergency_contacts",
  "ai_continue_notify",
  "stop_ai_handoff",
] as const;

export type MctbEmergencyAction = (typeof MCTB_EMERGENCY_ACTIONS)[number];

export const MCTB_FIELD_REQUIREMENTS = ["off", "optional", "required"] as const;
export type MctbFieldRequirement = (typeof MCTB_FIELD_REQUIREMENTS)[number];

export type MctbLeadFieldId =
  | "caller_name"
  | "service_reason"
  | "urgency"
  | "location_zip"
  | "service_address"
  | "callback_time"
  | "customer_type"
  | "appointment_intent"
  | "additional_details";

export type MctbLeadFieldConfig = {
  id: MctbLeadFieldId;
  label: string;
  requirement: MctbFieldRequirement;
  sortOrder: number;
};

export type MctbEventChannelPrefs = {
  sms?: boolean;
  email?: boolean;
  in_app?: boolean;
};

export type MctbRoutingMatrix = Partial<
  Record<MctbHandoffEventType, { channels: MctbEventChannelPrefs; recipientIds: string[] }>
>;

export type MctbHandoffConfigDto = {
  responseMode: MctbResponseMode;
  emergencyDetectionEnabled: boolean;
  emergencyCriteria: string | null;
  emergencyAction: MctbEmergencyAction;
  emergencyUncertainBehavior: "treat_normal" | "clarify" | "handoff_human";
  bookingBehavior: "off" | "on_request" | "selected_services" | "ai_when_fit";
  fieldSchema: MctbLeadFieldConfig[];
  routingMatrix: MctbRoutingMatrix;
  quietHours: {
    enabled: boolean;
    start: string | null;
    end: string | null;
    emergencyBypass: boolean;
    nonUrgentSmsDelay: boolean;
  };
};

export type MctbNotificationRecipientDto = {
  id: string;
  name: string;
  email: string | null;
  mobileE164: string | null;
  roleDescription: string | null;
  eventChannels: Partial<Record<MctbHandoffEventType, MctbEventChannelPrefs>>;
  enabled: boolean;
  sortOrder: number;
};

export type MctbLeadSnapshotFacts = {
  callerPhone?: string;
  callerName?: string;
  serviceReason?: string;
  urgency?: string;
  locationZip?: string;
  serviceAddress?: string;
  callbackTime?: string;
  customerType?: string;
  appointmentIntent?: string;
  additionalDetails?: string;
  customerMessages?: string[];
};

export type MctbLeadSnapshotDerived = {
  aiSummary?: string;
  urgencyClassification?: string;
  urgencyReason?: string;
  requestedAction?: string;
};
