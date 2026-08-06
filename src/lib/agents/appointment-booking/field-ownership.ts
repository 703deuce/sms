/**
 * Canonical ownership of appointment-wizard fields.
 * Wizard remains the deployment engine; data must land in the right layer.
 *
 * Precedence at runtime:
 *   Approved Company Brain fact → company information
 *   Amy AgentVersion → appointment-specific behavior
 *   Call context → this call right now
 */

export type FieldOwner =
  | "company_brain"
  | "amy_profile"
  | "deployment_runtime"
  | "temporary_setup";

export type MigrationPhase =
  | "audit"
  | "backfill"
  | "dual_read"
  | "sync_verify"
  | "writes_removed"
  | "deprecated";

export type FieldOwnershipRow = {
  field: string;
  owner: FieldOwner;
  /** Legacy storage (wizard draft / VoiceAgent draftConfig path) */
  oldTable: string;
  /** Canonical write target after unify */
  newCanonical: string;
  migrationStatus: MigrationPhase;
  /** Temporary read fallback to old wizard field when new is missing */
  readFallback: boolean;
  /** Old direct write path disabled? */
  writePathRemoved: boolean;
  notes?: string;
};

/** Every wizard state field → one canonical owner + migration status. */
export const WIZARD_FIELD_OWNERSHIP: FieldOwnershipRow[] = [
  // ── Company Brain ──────────────────────────────────────────────
  {
    field: "businessName",
    owner: "company_brain",
    oldTable: "VoiceAgent.draftConfig / SolutionSetup.state",
    newCanonical: "CompanyBrain.businessName",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
    notes: "Wizard save syncs via syncCompanyBrainFromWizard; new writes prefer Brain",
  },
  {
    field: "websiteUrl",
    owner: "company_brain",
    oldTable: "SolutionSetup.state.websiteUrl",
    newCanonical: "CompanyBrain.website",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "timezone",
    owner: "company_brain",
    oldTable: "SolutionSetup.state.timezone",
    newCanonical: "CompanyBrain.defaultTimezone",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
    notes: "Also injected as Amy runtime context for the call",
  },
  {
    field: "knowledgeItems",
    owner: "company_brain",
    oldTable: "SolutionSetup.state.knowledgeItems",
    newCanonical: "CompanyBrain.knowledgeFacts (approved only)",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
    notes: "Pending/extracted stay in review; only approved facts are truth",
  },
  {
    field: "transferDestinationName",
    owner: "company_brain",
    oldTable: "SolutionSetup.state",
    newCanonical: "CompanyBrain.transferDestinations / staff",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
    notes: "Shared contacts; Amy selects which destination to use",
  },
  {
    field: "transferDestinationPhone",
    owner: "company_brain",
    oldTable: "SolutionSetup.state",
    newCanonical: "CompanyBrain.transferDestinations.phone",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "appointmentTypes[].name",
    owner: "company_brain",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "CompanyBrain.services[].name",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
    notes: "Catalog service; Amy chooses bookable subset + duration",
  },
  {
    field: "appointmentTypes[].description",
    owner: "company_brain",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "CompanyBrain.services[].description",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },

  // ── Amy profile / AgentVersion ─────────────────────────────────
  {
    field: "solutionName",
    owner: "amy_profile",
    oldTable: "VoiceAgent.name / SolutionSetup",
    newCanonical: "VoiceAgent.displayName + AgentVersion",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "agentName",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.agentName",
    newCanonical: "AgentIdentity.name on VoiceAgent",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "role",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.role",
    newCanonical: "AgentIdentity.role (fixed appointment_booking)",
    migrationStatus: "writes_removed",
    readFallback: false,
    writePathRemoved: true,
    notes: "Hire locks booking job — role is not editable",
  },
  {
    field: "capabilities",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.capabilities",
    newCanonical: "AgentVersion.bookingPolicy + enabledBuiltinTools",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "answerWhen",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.answerWhen",
    newCanonical: "AgentVersion.routing / ringBehavior",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "collectFields",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.collectFields",
    newCanonical: "AgentVersion.collectionFields (typed)",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "bookingBehavior",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.bookingBehavior",
    newCanonical: "AgentVersion.bookingPolicy",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "appointmentTypes[].durationMin",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "AgentVersion.bookableServices[].durationMin",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "appointmentTypes[].minNotice",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "AgentVersion.bookingPolicy.minimumNoticeMinutes",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "appointmentTypes[].maxDaysAhead",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "AgentVersion.bookingPolicy.maximumAdvanceDays",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "appointmentTypes[].requiredFields",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "AgentVersion.collectionFields + service scoping",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "appointmentTypes[].bookingPermission",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "AgentVersion.bookingPolicy.bookingMode",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "appointmentTypes[].enabled",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.appointmentTypes",
    newCanonical: "AgentVersion.bookableServices subset",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "transferTriggers",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state.transferTriggers",
    newCanonical: "AgentVersion.transferRules",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "transferRingSeconds",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.transferRules",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "transferFallback",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.fallbackPolicy",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "warmTransfer",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.transferRules.warmTransfer",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "detectVoicemailOnTransfer",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.transferRules",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "voiceId",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state / draftConfig.voiceLanguage",
    newCanonical: "AgentVersion.voice",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "voiceLabel",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice.label",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "speakingSpeed",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice.speakingSpeed",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "responsiveness",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "interruptionSensitivity",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "openingGreeting",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state / draftConfig.greeting",
    newCanonical: "AgentVersion.greeting",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "tone",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice.tone (appointment-specific; brand tone stays Brain)",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "speakingStyle",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice.style",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "language",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice.language",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "speaksFirst",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.voice.speaksFirst",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "conversationBehaviors",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.conversationBehaviors",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "guardrails",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.guardrails",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "longTermMemory",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.memoryPolicy",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "crmEnabled",
    owner: "amy_profile",
    oldTable: "SolutionSetup.state",
    newCanonical: "AgentVersion.integrations.crm",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },

  // ── Deployment / runtime (not business memory) ─────────────────
  {
    field: "agentId",
    owner: "deployment_runtime",
    oldTable: "VoiceAgent.id",
    newCanonical: "VoiceAgent.id (wrapped, not duplicated)",
    migrationStatus: "writes_removed",
    readFallback: false,
    writePathRemoved: true,
    notes: "Do not create a second VoiceAgent for the Agent layer",
  },
  {
    field: "setupId",
    owner: "deployment_runtime",
    oldTable: "SolutionSetup.id",
    newCanonical: "SolutionSetup.id linked from VoiceAgent",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "telnyxAssistantId",
    owner: "deployment_runtime",
    oldTable: "VoiceAgent.telnyxAssistantId",
    newCanonical: "VoiceAgent.telnyxAssistantId",
    migrationStatus: "writes_removed",
    readFallback: false,
    writePathRemoved: true,
    notes: "Only deployAppointmentAgent / publishVoiceAgent mutates",
  },
  {
    field: "phoneNumberId",
    owner: "deployment_runtime",
    oldTable: "VoiceAgent.linkedPhoneNumberIds",
    newCanonical: "resource assignment on VoiceAgent",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "phoneNumberE164",
    owner: "deployment_runtime",
    oldTable: "PhoneNumber.e164",
    newCanonical: "PhoneNumber via assignment",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "calendarProvider",
    owner: "deployment_runtime",
    oldTable: "VoiceCalendarConnection.provider",
    newCanonical: "calendar connection assignment",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "calendarConnected",
    owner: "deployment_runtime",
    oldTable: "VoiceCalendarConnection.status",
    newCanonical: "calendar connection status",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "calendarEmail",
    owner: "deployment_runtime",
    oldTable: "VoiceCalendarConnection",
    newCanonical: "calendar connection",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "linkedKnowledgeBaseId",
    owner: "deployment_runtime",
    oldTable: "VoiceAgent.linkedKnowledgeBaseId",
    newCanonical: "VoiceAgent knowledge link",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "ringBehavior",
    owner: "deployment_runtime",
    oldTable: "SolutionSetup / TeXML route",
    newCanonical: "deployment routing config",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "ringTeamSeconds",
    owner: "deployment_runtime",
    oldTable: "SolutionSetup",
    newCanonical: "deployment routing config",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "callRecording",
    owner: "deployment_runtime",
    oldTable: "SolutionSetup / Telnyx",
    newCanonical: "deployment recording policy",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "outcomeSlug",
    owner: "deployment_runtime",
    oldTable: "SolutionSetup.outcomeSlug",
    newCanonical: "agent type catalog slug",
    migrationStatus: "writes_removed",
    readFallback: false,
    writePathRemoved: true,
  },
  {
    field: "preset",
    owner: "deployment_runtime",
    oldTable: "SolutionSetup.preset",
    newCanonical: "hire preset metadata",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },

  // ── Temporary setup UX ─────────────────────────────────────────
  {
    field: "numberSource",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "setup progress only",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "knowledgeSource",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "setup progress only",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "selectedAppointmentTypeId",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "setup UI selection",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "testScenario",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "test session state",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "lastTestPassed",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "test session state",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "activationMode",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "activation job progress",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "scheduledAt",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "scheduled activate job",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "connectionGreeting",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "ring-first greeting mode (deploy-time)",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "connectionGreetingText",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "ring-first greeting text",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
  {
    field: "connectionGreetingAudioUrl",
    owner: "temporary_setup",
    oldTable: "SolutionSetup.state",
    newCanonical: "ring-first greeting audio",
    migrationStatus: "dual_read",
    readFallback: true,
    writePathRemoved: false,
  },
];

export function fieldsForOwner(owner: FieldOwner): string[] {
  return WIZARD_FIELD_OWNERSHIP.filter((r) => r.owner === owner).map((r) => r.field);
}

export function migrationReport(): {
  phase: string;
  principle: string;
  deployPath: string;
  rows: FieldOwnershipRow[];
  summary: Record<FieldOwner, number>;
  dualReadCount: number;
  writePathRemovedCount: number;
} {
  const summary = {
    company_brain: fieldsForOwner("company_brain").length,
    amy_profile: fieldsForOwner("amy_profile").length,
    deployment_runtime: fieldsForOwner("deployment_runtime").length,
    temporary_setup: fieldsForOwner("temporary_setup").length,
  };
  return {
    phase: "Phase 3 — dual-read; new writes prefer Brain + Amy draft; wizard activate remains sole deploy",
    principle:
      "Keep wizard machinery. Move ownership of its data to Brain and Amy, then let Amy drive that machinery.",
    deployPath: "POST /api/solutions/appointment-receptionist action=activate",
    rows: WIZARD_FIELD_OWNERSHIP,
    summary,
    dualReadCount: WIZARD_FIELD_OWNERSHIP.filter((r) => r.readFallback).length,
    writePathRemovedCount: WIZARD_FIELD_OWNERSHIP.filter((r) => r.writePathRemoved).length,
  };
}
