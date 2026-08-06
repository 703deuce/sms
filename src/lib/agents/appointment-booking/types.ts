/**
 * Appointment Booking Agent — typed operating model.
 * VoiceAgent remains the DB parent; these types are the product view.
 */

export const APPOINTMENT_BOOKING_ROLE = "appointment_booking" as const;

export type AgentProductStatus =
  | "draft"
  | "configuring"
  | "testing"
  | "ready"
  | "active"
  | "paused"
  | "needs_attention"
  | "failed"
  | "archived";

export type AgentIdentity = {
  id: string;
  workspaceId: string;
  name: string;
  displayName: string;
  role: typeof APPOINTMENT_BOOKING_ROLE;
  channel: "voice";
  description: string;
  avatarId?: string;
  status: AgentProductStatus;
};

export type BookingMode =
  | "exact_slot"
  | "arrival_window"
  | "request_only"
  | "staff_confirmation_required";

export type BookingPolicy = {
  canBook: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  requireCallerName: boolean;
  requirePhoneNumber: boolean;
  requireEmail: boolean;
  requireServiceAddress: boolean;
  appointmentDurationMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  allowedServices: string[];
  allowedLocations: string[];
  requireFinalConfirmation: boolean;
  sendSmsConfirmation: boolean;
  bookingMode: BookingMode;
  sameDayCutoff?: string | null;
};

export type AppointmentAgentProfile = {
  agentId: string;
  locationIds: string[];
  serviceIds: string[];
  calendarConnectionIds: string[];
  bookingMode: BookingMode;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  requiredFields: {
    name: boolean;
    phone: boolean;
    email: boolean;
    serviceAddress: boolean;
    service: boolean;
  };
  canBook: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  requireFinalConfirmation: boolean;
  sendConfirmationSms: boolean;
  transferPolicySummary?: string | null;
  fallbackPolicySummary?: string | null;
  voiceSummary?: string | null;
  timezone: string;
};

export type BusinessLocation = {
  id: string;
  name: string;
  timezone: string;
  address?: string;
  phoneNumberId?: string | null;
  calendarId?: string | null;
};

export type BusinessBrain = {
  businessName: string;
  legalName?: string;
  website?: string;
  defaultTimezone: string;
  locations: BusinessLocation[];
  services: Array<{ id: string; name: string; durationMinutes?: number }>;
  businessHoursSummary?: string | null;
  staff: Array<{ id: string; name: string; role?: string }>;
  transferDestinations: Array<{ id: string; name: string; phone?: string }>;
  brandVoice?: string | null;
  approvedPolicies: string[];
  prohibitedClaims: string[];
  knowledgeFacts: Array<{ label: string; summary: string; status?: string }>;
};

export type HealthLevel = "healthy" | "warning" | "failed" | "degraded" | "unknown";

export type HealthCheck = {
  status: HealthLevel;
  message: string;
  required: boolean;
  checkedAt: string;
};

export type AgentHealth = {
  overall: HealthLevel;
  telnyxAssistant: HealthCheck;
  assignedNumber: HealthCheck;
  calendar: HealthCheck;
  bookingTools: HealthCheck;
  transferTargets: HealthCheck;
  smsConfirmation: HealthCheck;
  webhookEndpoint: HealthCheck;
  latestDeployment: HealthCheck;
  primaryWorkflow: HealthCheck;
  lastCheckedAt: string;
};

export type AgentMetrics = {
  callsAnswered: number;
  bookingConversationsStarted: number;
  appointmentsBooked: number;
  bookingConversionRate: number;
  transfers: number;
  messagesTaken: number;
  bookingFailures: number;
  calendarFailures: number;
  windowDays: number;
};

export type AgentExecutionStep = {
  sequence: number;
  nodeId?: string;
  blockType: string;
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  status: "started" | "succeeded" | "failed" | "skipped";
  sanitizedInput?: unknown;
  sanitizedOutput?: unknown;
  errorCode?: string;
  errorMessage?: string;
};

export type AgentExecutionOutcome =
  | "appointment_booked"
  | "appointment_requested"
  | "transferred"
  | "message_taken"
  | "abandoned"
  | "failed"
  | "completed"
  | "unknown";

export type AgentExecutionTrace = {
  executionId: string;
  agentId: string;
  agentVersionId?: string | null;
  callId: string;
  startedAt: string;
  completedAt?: string | null;
  steps: AgentExecutionStep[];
  outcome: AgentExecutionOutcome;
  failureCode?: string | null;
  callerPhone?: string | null;
  calledNumber?: string | null;
  summary: string;
};

export type AppointmentBookingAgentView = {
  identity: AgentIdentity;
  voiceAgentId: string;
  telnyxAssistantId?: string | null;
  solutionSetupId?: string | null;
  primaryFlowId?: string | null;
  phoneNumberIds: string[];
  phoneNumberE164?: string | null;
  calendarConnectionIds: string[];
  automationFlowIds: string[];
  executionMode: "conversational_with_deterministic_tools";
  profile: AppointmentAgentProfile;
  bookingPolicy: BookingPolicy;
  businessBrain: BusinessBrain;
  health: AgentHealth;
  metrics: AgentMetrics;
  currentVersionId?: string | null;
  versions: Array<{
    id: string;
    version: number;
    changeLog?: string | null;
    publishedAt: string;
    isMain: boolean;
    deploymentStatus?: string | null;
    testStatus?: string | null;
  }>;
  resources: {
    numberLabel: string;
    calendarLabel: string;
    workflowLabel: string;
    locationLabel: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AgentControlCommand =
  | "get_agent_summary"
  | "get_agent_configuration"
  | "get_agent_health"
  | "get_agent_metrics"
  | "search_agent_activity"
  | "get_call_details"
  | "explain_call_failure"
  | "get_execution_trace"
  | "list_versions"
  | "pause_agent"
  | "resume_agent"
  | "owner_ask"
  | "create_change_proposal"
  | "list_change_proposals"
  | "confirm_change_proposal"
  | "reject_change_proposal"
  | "create_workflow_draft"
  | "validate_workflow_draft"
  | "list_workflow_drafts"
  | "run_agent_test_snapshot"
  | "activate_agent_version"
  | "rollback_agent_version"
  | "duplicate_agent";

export const DEFAULT_RANDY_NAME = "Randy";
export const DEFAULT_RANDY_DISPLAY = "Randy — Appointment Booking Agent";
export const DEFAULT_RANDY_DESCRIPTION =
  "Answers calls, checks real availability, and books appointments using your calendar.";
