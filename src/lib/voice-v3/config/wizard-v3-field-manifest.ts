/**
 * Authoritative worksheet: wizard state paths → Voice V3 destinations.
 * Tests assert every path here remains wired when wizard schema changes.
 */

export type WizardV3Destination =
  | "LIVE_FRONTEND_CONTEXT"
  | "ASTRA_BACKEND_CONTEXT"
  | "DETERMINISTIC_CONFIG"
  | "TOOL_API_DATA"
  | "PROVIDER_CONFIG"
  | "RAG_CONFIG"
  | "CONTROL_PLANE_ONLY"
  | "INTENTIONALLY_UNSUPPORTED"
  | "FUTURE";

export type WizardV3FieldManifestRow = {
  statePath: string;
  ui: string;
  step: number;
  destinations: WizardV3Destination[];
  v3ConfigPaths: string[];
  status: "WIRED" | "PARTIAL" | "NOT_WIRED" | "FUTURE";
  currentScope:
    | "YES_MICROSOFT_BOOKING"
    | "YES_GENERAL"
    | "FUTURE_CALENDLY"
    | "FUTURE_BOOKING_LINK"
    | "FUTURE_CRM"
    | "FUTURE_RAG_EXECUTION"
    | "CONTROL_PLANE";
};

/** Core wizard fields — extend when UI adds controls (see migration plan doc). */
export const WIZARD_V3_FIELD_MANIFEST: WizardV3FieldManifestRow[] = [
  {
    statePath: "capabilities[]",
    ui: "Capability toggles",
    step: 1,
    destinations: ["DETERMINISTIC_CONFIG", "LIVE_FRONTEND_CONTEXT", "ASTRA_BACKEND_CONTEXT"],
    v3ConfigPaths: ["capabilities.*", "tools catalog"],
    status: "WIRED",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "answerWhen",
    ui: "When agent answers",
    step: 1,
    destinations: ["PROVIDER_CONFIG"],
    v3ConfigPaths: ["telephony.answerWhen"],
    status: "PARTIAL",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "solutionName",
    ui: "Agent / solution name",
    step: 1,
    destinations: ["CONTROL_PLANE_ONLY"],
    v3ConfigPaths: ["controlPlane.solutionName"],
    status: "WIRED",
    currentScope: "CONTROL_PLANE",
  },
  {
    statePath: "businessName",
    ui: "Business name",
    step: 3,
    destinations: ["LIVE_FRONTEND_CONTEXT", "ASTRA_BACKEND_CONTEXT", "DETERMINISTIC_CONFIG"],
    v3ConfigPaths: ["businessName"],
    status: "WIRED",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "timezone",
    ui: "Timezone",
    step: 3,
    destinations: ["ASTRA_BACKEND_CONTEXT", "DETERMINISTIC_CONFIG"],
    v3ConfigPaths: ["timezone"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "knowledgeItems[].summary",
    ui: "Knowledge item information",
    step: 3,
    destinations: ["LIVE_FRONTEND_CONTEXT", "RAG_CONFIG"],
    v3ConfigPaths: ["business.*", "knowledge.hotContext", "knowledge.retrieval"],
    status: "WIRED",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "websiteUrl",
    ui: "Website URL",
    step: 3,
    destinations: ["RAG_CONFIG"],
    v3ConfigPaths: ["knowledge.retrieval.websiteUrl"],
    status: "WIRED",
    currentScope: "FUTURE_RAG_EXECUTION",
  },
  {
    statePath: "linkedKnowledgeBaseId",
    ui: "Linked knowledge base",
    step: 3,
    destinations: ["RAG_CONFIG"],
    v3ConfigPaths: ["knowledge.retrieval.knowledgeBaseIds"],
    status: "WIRED",
    currentScope: "FUTURE_RAG_EXECUTION",
  },
  {
    statePath: "operatingMaturity.businessSchedule.weekly",
    ui: "Business hours (per day)",
    step: 3,
    destinations: ["LIVE_FRONTEND_CONTEXT", "DETERMINISTIC_CONFIG"],
    v3ConfigPaths: ["business.hoursDisplay", "businessHours"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "bookingStrategy",
    ui: "Booking strategy",
    step: 4,
    destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
    v3ConfigPaths: ["scheduling.bookingStrategy"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "appointmentTypes[].durationMin",
    ui: "Appointment duration",
    step: 4,
    destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
    v3ConfigPaths: ["services[].durationMinutes", "service.durationMinutes"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "appointmentTypes[].enabled",
    ui: "Appointment enabled",
    step: 4,
    destinations: ["DETERMINISTIC_CONFIG", "LIVE_FRONTEND_CONTEXT"],
    v3ConfigPaths: ["services[]"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "selectedAppointmentTypeId",
    ui: "Primary appointment type",
    step: 4,
    destinations: ["DETERMINISTIC_CONFIG"],
    v3ConfigPaths: ["scheduling.primaryServiceId", "service"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "collectFields[].required",
    ui: "Required caller field",
    step: 4,
    destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
    v3ConfigPaths: ["intakeFields[].required", "operationRequirements.book_appointment"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "collectFields[].label",
    ui: "Caller field label",
    step: 4,
    destinations: ["ASTRA_BACKEND_CONTEXT"],
    v3ConfigPaths: ["intakeFields[].label", "intakeFields[].description"],
    status: "WIRED",
    currentScope: "YES_MICROSOFT_BOOKING",
  },
  {
    statePath: "transferDestinations[]",
    ui: "Transfer destinations",
    step: 5,
    destinations: ["DETERMINISTIC_CONFIG", "PROVIDER_CONFIG", "ASTRA_BACKEND_CONTEXT"],
    v3ConfigPaths: ["transferDestinations[]"],
    status: "WIRED",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "agentName",
    ui: "Agent name",
    step: 6,
    destinations: ["LIVE_FRONTEND_CONTEXT"],
    v3ConfigPaths: ["identity.agentName", "conversation.openingGreeting"],
    status: "WIRED",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "openingGreeting",
    ui: "Opening greeting",
    step: 6,
    destinations: ["LIVE_FRONTEND_CONTEXT"],
    v3ConfigPaths: ["conversation.openingGreeting"],
    status: "WIRED",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "voiceId",
    ui: "Voice",
    step: 6,
    destinations: ["PROVIDER_CONFIG"],
    v3ConfigPaths: ["telephony.liveVoiceId"],
    status: "WIRED",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "speakingSpeed",
    ui: "Speaking speed",
    step: 6,
    destinations: ["INTENTIONALLY_UNSUPPORTED"],
    v3ConfigPaths: [],
    status: "PARTIAL",
    currentScope: "YES_GENERAL",
  },
  {
    statePath: "testScenario",
    ui: "Test scenario",
    step: 7,
    destinations: ["CONTROL_PLANE_ONLY"],
    v3ConfigPaths: ["controlPlane.testScenario"],
    status: "WIRED",
    currentScope: "CONTROL_PLANE",
  },
  {
    statePath: "activationMode",
    ui: "Activation mode",
    step: 8,
    destinations: ["CONTROL_PLANE_ONLY"],
    v3ConfigPaths: ["controlPlane.activationMode"],
    status: "WIRED",
    currentScope: "CONTROL_PLANE",
  },
];
