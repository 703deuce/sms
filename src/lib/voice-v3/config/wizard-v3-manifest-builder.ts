import type { CapabilityId } from "@/lib/solutions/appointment-receptionist/types";
import {
  WIZARD_QUALIFICATION_RULE_CONTROL_PATHS,
  WIZARD_URGENCY_RULE_CONTROL_PATHS,
} from "./wizard-control-inventory";
import type { WizardV3ExecutionStatus } from "./wizard-execution-status";
import { classifyWizardRuntimeLeaf } from "./wizard-v3-runtime-launch-classification";

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
  step: number;
  uiLabel: string;
  statePath: string;
  valueType: string;
  v3ConfigPath: string;
  destinations: WizardV3Destination[];
  executionStatus: WizardV3ExecutionStatus;
  scope: string;
  compilerFunction: string;
  runtimeConsumer: string;
  republishBehavior: "next_call" | "active_call_unchanged" | "control_plane_only";
  testCoverage: string;
};

const CAPABILITY_IDS: CapabilityId[] = [
  "answer_questions",
  "book_appointments",
  "reschedule",
  "cancel",
  "take_messages",
  "qualify_callers",
  "transfer_calls",
  "send_sms_confirmations",
];

const BOOKING_BEHAVIOR_KEYS = [
  "askPreferredDayFirst",
  "offerEarliestThree",
  "confirmBeforeBooking",
  "sendSmsAfterBooking",
  "askServiceFirst",
  "distinguishNewExisting",
] as const;

const CONVERSATION_BEHAVIOR_KEYS = [
  "keepBrief",
  "oneQuestionAtATime",
  "confirmDetails",
  "neverInventPricing",
  "neverInventAvailability",
] as const;

const APPOINTMENT_TYPE_FIELDS = [
  "id",
  "name",
  "durationMin",
  "calendar",
  "status",
  "location",
  "modality",
  "description",
  "bookingHours",
  "minNotice",
  "maxDaysAhead",
  "requiredFields",
  "bookingPermission",
  "enabled",
] as const;

const COLLECT_FIELD_KEYS = ["id", "label", "required", "enabled", "useForQualification"] as const;

const KNOWLEDGE_ITEM_FIELDS = ["id", "label", "summary", "status", "statusLabel"] as const;

const TRANSFER_DEST_FIELDS = ["id", "label", "phoneE164", "enabled"] as const;

const TRANSFER_PLAN_FIELDS = ["order", "destinationId", "transferMode", "timeoutSeconds"] as const;

function row(
  partial: Omit<WizardV3FieldManifestRow, "testCoverage"> & { testCoverage?: string },
): WizardV3FieldManifestRow {
  return {
    testCoverage: partial.testCoverage ?? "manifest-invariant",
    ...partial,
  };
}

function microsoftExecution(strategyPath: string): WizardV3ExecutionStatus {
  return strategyPath.includes("MICROSOFT")
    ? "ACTIVE_EXECUTION"
    : "CONFIGURED_NOT_IMPLEMENTED";
}

function executionStatusFromLaunchClassification(
  statePath: string,
  current: WizardV3ExecutionStatus,
): WizardV3ExecutionStatus {
  if (
    current === "ACTIVE_EXECUTION" ||
    current === "LIVE_PROMPT_CONTROL" ||
    current === "CONTROL_PLANE_ONLY" ||
    current === "PROVIDER_CONFIG" ||
    current === "UNSUPPORTED_BY_CURRENT_LIVE_API"
  ) {
    return current;
  }
  const { classification, runtimeConsumer } = classifyWizardRuntimeLeaf(statePath);
  switch (classification) {
    case "CURRENT_VISIBLE_IMPLEMENTED":
    case "CHILD_IMPLEMENTED_BY_PARENT":
      return "ACTIVE_EXECUTION";
    case "CONTROL_PLANE_ACTIVE":
      return "ACTIVE_CONTROL_PLANE";
    case "OUT_OF_SCOPE_RETIRED":
      return "OUT_OF_SCOPE_RETIRED";
    case "UI_METADATA_ONLY":
      return "UI_METADATA_ONLY";
    case "HIDDEN_STATE_ONLY":
      return "HIDDEN_STATE_ONLY";
    case "MCTB_ONLY":
      return "MCTB_ONLY";
    case "LEGACY_OBSOLETE":
      return "LEGACY_OBSOLETE";
    case "DEFERRED_NOT_EXPOSED":
      return "DEFERRED_NOT_EXPOSED";
    case "CURRENT_VISIBLE_STILL_BROKEN":
      return "CONFIGURED_NOT_IMPLEMENTED";
    default:
      return current;
  }
}

function applyLaunchClassificationToManifest(
  rows: WizardV3FieldManifestRow[],
): WizardV3FieldManifestRow[] {
  return rows.map((r) => {
    const nextStatus = executionStatusFromLaunchClassification(r.statePath, r.executionStatus);
    if (nextStatus === r.executionStatus) return r;
    const launch = classifyWizardRuntimeLeaf(r.statePath);
    const runtimeConsumer =
      launch.runtimeConsumer?.trim() ||
      (launch.classification === "CURRENT_VISIBLE_IMPLEMENTED" ||
      launch.classification === "CHILD_IMPLEMENTED_BY_PARENT"
        ? launch.evidence
        : r.runtimeConsumer);
    return { ...r, executionStatus: nextStatus, runtimeConsumer };
  });
}

/** Exhaustive wizard Steps 1–8 control inventory → V3 manifest. */
export function buildWizardV3FieldManifest(): WizardV3FieldManifestRow[] {
  const rows: WizardV3FieldManifestRow[] = [];

  for (const cap of CAPABILITY_IDS) {
    rows.push(
      row({
        step: 1,
        uiLabel: `Capability: ${cap}`,
        statePath: `capabilities.${cap}`,
        valueType: "boolean (membership)",
        v3ConfigPath: `capabilities.*`,
        destinations: ["DETERMINISTIC_CONFIG", "LIVE_FRONTEND_CONTEXT", "ASTRA_BACKEND_CONTEXT"],
        executionStatus: "ACTIVE_EXECUTION",
        scope: "YES_GENERAL",
        compilerFunction: "capabilityFlagsFromWizard",
        runtimeConsumer: "voice-tool-catalog + authorize-tool-for-config",
        republishBehavior: "next_call",
      }),
    );
  }

  rows.push(
    row({
      step: 1,
      uiLabel: "When agent answers",
      statePath: "answerWhen",
      valueType: "AnswerWhen",
      v3ConfigPath: "telephony.answerWhen",
      destinations: ["PROVIDER_CONFIG", "CONTROL_PLANE_ONLY"],
      executionStatus: "DEFERRED_NOT_EXPOSED",
      scope: "YES_GENERAL",
      compilerFunction: "compileVoiceV3AgentConfig.telephony (legacy compatibility)",
      runtimeConsumer: "CFNA ingress — not customer-facing on after_hours launch",
      republishBehavior: "next_call",
    }),
    row({
      step: 1,
      uiLabel: "Agent / solution name",
      statePath: "solutionName",
      valueType: "string",
      v3ConfigPath: "controlPlane.solutionName",
      destinations: ["CONTROL_PLANE_ONLY"],
      executionStatus: "CONTROL_PLANE_ONLY",
      scope: "CONTROL_PLANE",
      compilerFunction: "compileVoiceV3AgentConfig.controlPlane",
      runtimeConsumer: "workspace UI",
      republishBehavior: "control_plane_only",
    }),
  );

  const phoneFields: Array<[string, string, string, WizardV3Destination[], WizardV3ExecutionStatus]> = [
    ["numberSource", "Number source", "telephony.numberSource", ["PROVIDER_CONFIG"], "CONTROL_PLANE_ONLY"],
    ["phoneNumberId", "Inbound phone number id", "telephony.phoneNumberId", ["PROVIDER_CONFIG"], "ACTIVE_EXECUTION"],
    ["phoneNumberE164", "Inbound phone E.164", "telephony.phoneNumberE164", ["PROVIDER_CONFIG"], "ACTIVE_EXECUTION"],
    ["outboundSmsMode", "Outbound SMS mode", "telephony.outboundSmsMode", ["PROVIDER_CONFIG"], "CONFIGURED_NOT_IMPLEMENTED"],
    ["outboundSmsPhoneNumberId", "Outbound SMS number id", "telephony.outboundSmsPhoneNumberId", ["PROVIDER_CONFIG"], "CONFIGURED_NOT_IMPLEMENTED"],
    ["outboundSmsE164", "Outbound SMS E.164", "telephony.outboundSmsE164", ["PROVIDER_CONFIG"], "CONFIGURED_NOT_IMPLEMENTED"],
    ["ringBehavior", "Ring behavior", "telephony.ringBehavior", ["PROVIDER_CONFIG"], "DEFERRED_NOT_EXPOSED"],
    ["ringTeamSeconds", "Ring team seconds", "telephony.ringTeamSeconds", ["PROVIDER_CONFIG"], "DEFERRED_NOT_EXPOSED"],
    ["callRecording", "Call recording", "telephony.callRecording", ["PROVIDER_CONFIG"], "ACTIVE_EXECUTION"],
    ["connectionGreeting", "Connection greeting mode", "telephony.connectionGreetingMode", ["PROVIDER_CONFIG"], "ACTIVE_EXECUTION"],
    ["connectionGreetingText", "Connection greeting text", "telephony.connectionGreetingText", ["PROVIDER_CONFIG"], "ACTIVE_EXECUTION"],
    ["connectionGreetingAudioUrl", "Connection greeting audio URL", "telephony.connectionGreetingAudioUrl", ["PROVIDER_CONFIG"], "ACTIVE_EXECUTION"],
  ];
  for (const [path, label, v3, dests, exec] of phoneFields) {
    rows.push(
      row({
        step: 2,
        uiLabel: label,
        statePath: path,
        valueType: "wizard",
        v3ConfigPath: v3,
        destinations: dests,
        executionStatus: exec,
        scope: "YES_GENERAL",
        compilerFunction: "compileVoiceV3AgentConfig.telephony",
        runtimeConsumer: "Telnyx provisioning",
        republishBehavior: "next_call",
      }),
    );
  }

  rows.push(
    row({
      step: 3,
      uiLabel: "Knowledge source",
      statePath: "knowledgeSource",
      valueType: "KnowledgeSource",
      v3ConfigPath: "knowledge.retrieval",
      destinations: ["RAG_CONFIG", "CONTROL_PLANE_ONLY"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_RAG_EXECUTION",
      compilerFunction: "compileVoiceV3AgentConfig.knowledge",
      runtimeConsumer: "future RAG tool",
      republishBehavior: "next_call",
    }),
    row({
      step: 3,
      uiLabel: "Website URL",
      statePath: "websiteUrl",
      valueType: "string",
      v3ConfigPath: "knowledge.retrieval.websiteUrl",
      destinations: ["RAG_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_RAG_EXECUTION",
      compilerFunction: "compileVoiceV3AgentConfig.knowledge",
      runtimeConsumer: "future RAG crawl",
      republishBehavior: "next_call",
    }),
    row({
      step: 3,
      uiLabel: "Linked knowledge base",
      statePath: "linkedKnowledgeBaseId",
      valueType: "string | null",
      v3ConfigPath: "knowledge.retrieval.knowledgeBaseIds[]",
      destinations: ["RAG_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_RAG_EXECUTION",
      compilerFunction: "compileVoiceV3AgentConfig.knowledge",
      runtimeConsumer: "future RAG tool",
      republishBehavior: "next_call",
    }),
    row({
      step: 3,
      uiLabel: "Knowledge base enabled",
      statePath: "knowledgeBaseEnabled",
      valueType: "boolean",
      v3ConfigPath: "knowledge.retrieval.enabled",
      destinations: ["RAG_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_RAG_EXECUTION",
      compilerFunction: "compileVoiceV3AgentConfig.knowledge",
      runtimeConsumer: "future RAG tool",
      republishBehavior: "next_call",
    }),
    row({
      step: 3,
      uiLabel: "Knowledge base revision",
      statePath: "knowledgeBaseRevision",
      valueType: "string",
      v3ConfigPath: "knowledge.retrieval.revision",
      destinations: ["RAG_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_RAG_EXECUTION",
      compilerFunction: "compileVoiceV3AgentConfig.knowledge",
      runtimeConsumer: "future RAG tool",
      republishBehavior: "next_call",
    }),
    row({
      step: 3,
      uiLabel: "Business name",
      statePath: "businessName",
      valueType: "string",
      v3ConfigPath: "businessName",
      destinations: ["LIVE_FRONTEND_CONTEXT", "ASTRA_BACKEND_CONTEXT", "DETERMINISTIC_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_GENERAL",
      compilerFunction: "compileVoiceV3AgentConfig",
      runtimeConsumer: "Amy + Astra prompts",
      republishBehavior: "next_call",
      testCoverage: "test-voice-v3-wizard-compiler",
    }),
    row({
      step: 3,
      uiLabel: "Timezone",
      statePath: "timezone",
      valueType: "IANA timezone",
      v3ConfigPath: "timezone",
      destinations: ["ASTRA_BACKEND_CONTEXT", "DETERMINISTIC_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_MICROSOFT_BOOKING",
      compilerFunction: "compileVoiceV3AgentConfig",
      runtimeConsumer: "FIND/BOOK slot generator",
      republishBehavior: "next_call",
    }),
  );

  for (const field of KNOWLEDGE_ITEM_FIELDS) {
    const isHoursSummary = field === "summary";
    rows.push(
      row({
        step: 3,
        uiLabel: `Knowledge item ${field}`,
        statePath: `knowledgeItems[].${field}`,
        valueType: "string",
        v3ConfigPath: isHoursSummary
          ? "business.* / knowledge.hotContext (not businessHours)"
          : "business.* / knowledge.hotContext",
        destinations: isHoursSummary
          ? ["LIVE_FRONTEND_CONTEXT", "RAG_CONFIG"]
          : ["LIVE_FRONTEND_CONTEXT", "RAG_CONFIG"],
        executionStatus: "ACTIVE_EXECUTION",
        scope: "YES_GENERAL",
        compilerFunction: "hotContextFromWizard",
        runtimeConsumer: "Amy hot context; hours summary never sets businessHours",
        republishBehavior: "next_call",
        testCoverage: isHoursSummary ? "test-voice-v3-business-hours-invariant" : undefined,
      }),
    );
  }

  const omPaths = [
    ["operatingMaturity.businessSchedule.weekly", "Business hours (structured weekly)", "businessHours", "DETERMINISTIC_CONFIG"],
    ["operatingMaturity.businessSchedule.timezone", "Business schedule timezone", "timezone", "DETERMINISTIC_CONFIG"],
    ["operatingMaturity.onCall", "On-call configuration", "callHandling / scheduling", "CONFIGURED_NOT_IMPLEMENTED"],
    ["operatingMaturity.sla", "SLA configuration", "scheduling", "CONFIGURED_NOT_IMPLEMENTED"],
  ] as const;
  for (const [path, label, v3, dest] of omPaths) {
    rows.push(
      row({
        step: 3,
        uiLabel: label,
        statePath: path,
        valueType: "object",
        v3ConfigPath: v3,
        destinations: [dest as WizardV3Destination, "LIVE_FRONTEND_CONTEXT"],
        executionStatus:
          path.includes("weekly") ? "ACTIVE_EXECUTION" : "CONFIGURED_NOT_IMPLEMENTED",
        scope: path.includes("weekly") ? "YES_MICROSOFT_BOOKING" : "YES_GENERAL",
        compilerFunction: "businessHoursWindowFromWeeklySchedule / ensureWizardOperatingMaturity",
        runtimeConsumer: path.includes("weekly") ? "FIND/BOOK + Amy hoursDisplay" : "future",
        republishBehavior: "next_call",
      }),
    );
  }

  const weekDays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;
  for (const day of weekDays) {
    for (const [suffix, label] of [
      [".closed", `${day} closed`],
      [".ranges[].start", `${day} range start`],
      [".ranges[].end", `${day} range end`],
    ] as const) {
      rows.push(
        row({
          step: 3,
          uiLabel: `Business schedule ${label}`,
          statePath: `operatingMaturity.businessSchedule.weekly.${day}${suffix}`,
          valueType: "varies",
          v3ConfigPath: "businessHours + business.hoursDisplay",
          destinations: ["DETERMINISTIC_CONFIG", "LIVE_FRONTEND_CONTEXT"],
          executionStatus: "ACTIVE_EXECUTION",
          scope: "YES_MICROSOFT_BOOKING",
          compilerFunction: "businessHoursWindowFromWeeklySchedule",
          runtimeConsumer: "FIND/BOOK",
          republishBehavior: "next_call",
        }),
      );
    }
  }

  rows.push(
    row({
      step: 3,
      uiLabel: "After-hours use operating state",
      statePath: "operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls",
      valueType: "boolean",
      v3ConfigPath: "callHandling / scheduling (future)",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "YES_GENERAL",
      compilerFunction: "ensureWizardOperatingMaturity",
      runtimeConsumer: "future after-hours executor",
      republishBehavior: "next_call",
    }),
  );
  for (const key of [
    "allowLiveBooking",
    "allowCallbackRequest",
    "allowMessageTaking",
    "allowOnCallEscalation",
    "allowOfficeTransfer",
    "allowNormalTransferDestinations",
  ] as const) {
    rows.push(
      row({
        step: 3,
        uiLabel: `After-hours when closed: ${key}`,
        statePath: `operatingMaturity.afterHoursBehavior.whenClosed.${key}`,
        valueType: "boolean",
        v3ConfigPath: "callHandling (future)",
        destinations: ["DETERMINISTIC_CONFIG"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "ensureWizardOperatingMaturity",
        runtimeConsumer: "future after-hours executor",
        republishBehavior: "next_call",
      }),
    );
  }

  for (const field of ["id", "name", "startDate", "endDate", "closedAllDay"] as const) {
    rows.push(
      row({
        step: 3,
        uiLabel: `Holiday ${field}`,
        statePath: `operatingMaturity.businessSchedule.holidays[].${field}`,
        valueType: "varies",
        v3ConfigPath: "scheduling (future)",
        destinations: ["DETERMINISTIC_CONFIG"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "ensureWizardOperatingMaturity",
        runtimeConsumer: "future holiday closure",
        republishBehavior: "next_call",
      }),
    );
  }

  rows.push(
    row({
      step: 3,
      uiLabel: "On-call schedule enabled",
      statePath: "operatingMaturity.onCallSchedule.enabled",
      valueType: "boolean",
      v3ConfigPath: "callHandling (future)",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "YES_GENERAL",
      compilerFunction: "ensureWizardOperatingMaturity",
      runtimeConsumer: "future on-call routing",
      republishBehavior: "next_call",
    }),
  );
  const onCallEntryFields = [
    "id",
    "name",
    "dayOfWeek",
    "date",
    "startTime",
    "endTime",
    "destination.label",
    "destination.phoneE164",
    "priority",
    "enabled",
  ] as const;
  for (const field of onCallEntryFields) {
    rows.push(
      row({
        step: 3,
        uiLabel: `On-call entry ${field}`,
        statePath: `operatingMaturity.onCallSchedule.entries[].${field}`,
        valueType: "varies",
        v3ConfigPath: "callHandling.onCallSchedule (future)",
        destinations: ["DETERMINISTIC_CONFIG"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "ensureWizardOperatingMaturity",
        runtimeConsumer: "future on-call routing",
        republishBehavior: "next_call",
      }),
    );
  }

  for (const field of [
    "normalTarget",
    "normalCustomMinutes",
    "urgentTarget",
    "urgentCustomMinutes",
  ] as const) {
    rows.push(
      row({
        step: 3,
        uiLabel: `Callback SLA ${field}`,
        statePath: `operatingMaturity.callbackSla.${field}`,
        valueType: "varies",
        v3ConfigPath: "callHandling.callbackSla (future)",
        destinations: ["DETERMINISTIC_CONFIG"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "ensureWizardOperatingMaturity",
        runtimeConsumer: "future callback SLA",
        republishBehavior: "next_call",
      }),
    );
  }

  rows.push(
    row({
      step: 4,
      uiLabel: "Calendar provider",
      statePath: "calendarProvider",
      valueType: "string",
      v3ConfigPath: "integrations.calendarProvider",
      destinations: ["PROVIDER_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_MICROSOFT_BOOKING",
      compilerFunction: "compileVoiceV3AgentConfig.integrations",
      runtimeConsumer: "resolveMicrosoftProviderConnections",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Calendar connected",
      statePath: "calendarConnected",
      valueType: "boolean",
      v3ConfigPath: "integrations.calendarConnected",
      destinations: ["PROVIDER_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_MICROSOFT_BOOKING",
      compilerFunction: "compileVoiceV3AgentConfig.integrations",
      runtimeConsumer: "setup health",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Calendar email",
      statePath: "calendarEmail",
      valueType: "string",
      v3ConfigPath: "integrations.calendarEmail + calendar.connectionId",
      destinations: ["PROVIDER_CONFIG", "DETERMINISTIC_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_MICROSOFT_BOOKING",
      compilerFunction: "resolveMicrosoftConnectionForWizard",
      runtimeConsumer: "FIND/BOOK Microsoft adapter",
      republishBehavior: "next_call",
      testCoverage: "test-voice-v3-microsoft-connection-resolve",
    }),
    row({
      step: 4,
      uiLabel: "Booking strategy",
      statePath: "bookingStrategy",
      valueType: "VoiceWizardBookingStrategy",
      v3ConfigPath: "scheduling.bookingStrategy + bookingStrategyDetail",
      destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_MICROSOFT_BOOKING",
      compilerFunction: "deriveBookingStrategyFromWizard",
      runtimeConsumer: "tool catalog + booking dispatch",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Booking link URL",
      statePath: "bookingLinkUrl",
      valueType: "string",
      v3ConfigPath: "bookingStrategyDetail.bookingLinkUrl",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_BOOKING_LINK",
      compilerFunction: "compileVoiceV3AgentConfig.bookingStrategyDetail",
      runtimeConsumer: "future SEND_LINK executor",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Booking link label",
      statePath: "bookingLinkLabel",
      valueType: "string",
      v3ConfigPath: "bookingStrategyDetail.bookingLinkLabel",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_BOOKING_LINK",
      compilerFunction: "compileVoiceV3AgentConfig.bookingStrategyDetail",
      runtimeConsumer: "future SEND_LINK executor",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Calendly event type URI",
      statePath: "calendlyEventTypeUri",
      valueType: "string",
      v3ConfigPath: "bookingStrategyDetail.calendlyEventTypeUri",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_CALENDLY",
      compilerFunction: "compileVoiceV3AgentConfig.bookingStrategyDetail",
      runtimeConsumer: "future Calendly executor",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Calendly event type name",
      statePath: "calendlyEventTypeName",
      valueType: "string",
      v3ConfigPath: "bookingStrategyDetail.calendlyEventTypeName",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_CALENDLY",
      compilerFunction: "compileVoiceV3AgentConfig.bookingStrategyDetail",
      runtimeConsumer: "future Calendly executor",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Calendly duration",
      statePath: "calendlyEventTypeDurationMin",
      valueType: "number",
      v3ConfigPath: "bookingStrategyDetail.calendlyEventTypeDurationMin",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_CALENDLY",
      compilerFunction: "compileVoiceV3AgentConfig.bookingStrategyDetail",
      runtimeConsumer: "future Calendly executor",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Calendly timezone",
      statePath: "calendlyTimezone",
      valueType: "string",
      v3ConfigPath: "bookingStrategyDetail.calendlyTimezone",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "FUTURE_CALENDLY",
      compilerFunction: "compileVoiceV3AgentConfig.bookingStrategyDetail",
      runtimeConsumer: "future Calendly executor",
      republishBehavior: "next_call",
    }),
    row({
      step: 4,
      uiLabel: "Primary appointment type",
      statePath: "selectedAppointmentTypeId",
      valueType: "string",
      v3ConfigPath: "scheduling.primaryServiceId + service (compat)",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_MICROSOFT_BOOKING",
      compilerFunction: "resolvePrimaryService",
      runtimeConsumer: "resolveBookingServiceForRuntime default",
      republishBehavior: "next_call",
    }),
  );

  for (const field of APPOINTMENT_TYPE_FIELDS) {
    rows.push(
      row({
        step: 4,
        uiLabel: `Appointment type ${field}`,
        statePath: `appointmentTypes[].${field}`,
        valueType: "varies",
        v3ConfigPath: `services[].${field}`,
        destinations: ["DETERMINISTIC_CONFIG", "LIVE_FRONTEND_CONTEXT", "ASTRA_BACKEND_CONTEXT"],
        executionStatus: field === "enabled" || field === "durationMin" ? "ACTIVE_EXECUTION" : "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_MICROSOFT_BOOKING",
        compilerFunction: "wizardServices",
        runtimeConsumer: "FIND/BOOK duration via resolveBookingServiceForRuntime",
        republishBehavior: "next_call",
        testCoverage: field === "durationMin" ? "test-voice-v3-wizard-compiler" : undefined,
      }),
    );
  }

  for (const key of BOOKING_BEHAVIOR_KEYS) {
    rows.push(
      row({
        step: 4,
        uiLabel: `Booking behavior: ${key}`,
        statePath: `bookingBehavior.${key}`,
        valueType: "boolean",
        v3ConfigPath: `scheduling.bookingBehavior.${key}`,
        destinations: ["ASTRA_BACKEND_CONTEXT", "DETERMINISTIC_CONFIG"],
        executionStatus: "ACTIVE_EXECUTION",
        scope: "YES_MICROSOFT_BOOKING",
        compilerFunction: "compileVoiceV3AgentConfig.scheduling",
        runtimeConsumer: "Astra instructions",
        republishBehavior: "next_call",
      }),
    );
  }

  for (const key of COLLECT_FIELD_KEYS) {
    rows.push(
      row({
        step: 4,
        uiLabel: `Collect field ${key}`,
        statePath: `collectFields[].${key}`,
        valueType: "varies",
        v3ConfigPath: `intakeFields[].${key}`,
        destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT", "TOOL_API_DATA"],
        executionStatus: "ACTIVE_EXECUTION",
        scope: "YES_MICROSOFT_BOOKING",
        compilerFunction: "compileWizardCollectFieldsToV3Intake",
        runtimeConsumer: "update_intake + BOOK gate",
        republishBehavior: "next_call",
        testCoverage: key === "required" ? "test-voice-v3-wizard-republish-intake" : undefined,
      }),
    );
  }

  const qualFields = [
    "qualificationEnabled",
    "qualificationRequiredBeforePrimaryAction",
    "qualificationRevision",
    "qualificationRulesMatchMode",
    "qualificationNotQualifiedFallback",
    "qualificationNeedsReviewFallback",
  ] as const;
  for (const path of qualFields) {
    rows.push(
      row({
        step: 5,
        uiLabel: path,
        statePath: path,
        valueType: "varies",
        v3ConfigPath: `qualification.*`,
        destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "compileVoiceV3AgentConfig.qualification",
        runtimeConsumer: "future qualification executor",
        republishBehavior: "next_call",
      }),
    );
  }

  rows.push(
    row({
      step: 5,
      uiLabel: "Qualification supported zip codes",
      statePath: "qualificationSupportedZipCodes[]",
      valueType: "string[]",
      v3ConfigPath: "qualification.supportedZipCodes[]",
      destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
      executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      scope: "YES_GENERAL",
      compilerFunction: "qualificationFromWizard",
      runtimeConsumer: "future qualification executor",
      republishBehavior: "next_call",
    }),
  );

  for (const path of WIZARD_QUALIFICATION_RULE_CONTROL_PATHS) {
    const field = path.replace("qualificationRules[].", "");
    rows.push(
      row({
        step: 5,
        uiLabel: `Qualification rule ${field}`,
        statePath: path,
        valueType: "varies",
        v3ConfigPath: `qualification.rules[].${field}`,
        destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "qualificationFromWizard",
        runtimeConsumer: "future qualification executor",
        republishBehavior: "next_call",
      }),
    );
  }

  for (const path of WIZARD_URGENCY_RULE_CONTROL_PATHS) {
    const field = path.replace("urgencyRules[].", "");
    rows.push(
      row({
        step: 5,
        uiLabel: `Urgency rule ${field}`,
        statePath: path,
        valueType: "varies",
        v3ConfigPath: `callHandling.urgencyRules[].${field}`,
        destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "compileVoiceV3AgentConfig.callHandling",
        runtimeConsumer: "future urgency executor",
        republishBehavior: "next_call",
      }),
    );
  }

  rows.push(
    row({
      step: 4,
      uiLabel: "Appointment type required intake keys",
      statePath: "appointmentTypes[].requiredFields[]",
      valueType: "string[]",
      v3ConfigPath: "services[].requiredIntakeKeys[]",
      destinations: ["DETERMINISTIC_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_MICROSOFT_BOOKING",
      compilerFunction: "servicePolicyFromWizardType + operation-requirements",
      runtimeConsumer: "getMissingFieldsForOperation(book_appointment)",
      republishBehavior: "next_call",
    }),
  );

  rows.push(
    row({
      step: 5,
      uiLabel: "Transfer trigger phrases",
      statePath: "transferTriggers[]",
      valueType: "string[]",
      v3ConfigPath: "callHandling.transferTriggers[]",
      destinations: ["LIVE_FRONTEND_CONTEXT", "ASTRA_BACKEND_CONTEXT", "DETERMINISTIC_CONFIG"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_GENERAL",
      compilerFunction: "compileVoiceV3AgentConfig.callHandling",
      runtimeConsumer: "Amy + transfer_call policy",
      republishBehavior: "next_call",
    }),
  );

  const callHandlingScalars: Array<[string, string]> = [
    ["transferDestinationName", "Legacy transfer destination name"],
    ["transferDestinationPhone", "Legacy transfer destination phone"],
    ["transferRingSeconds", "Transfer ring seconds"],
    ["transferFallback", "Transfer fallback action"],
    ["warmTransfer", "Warm transfer"],
    ["detectVoicemailOnTransfer", "Detect voicemail on transfer"],
    ["voiceV2HumanTransferEnabled", "Human transfer enabled"],
    ["allowCallerRequestedTransfer", "Allow caller-requested transfer"],
    ["transferRouting", "Transfer routing mode"],
    ["defaultTransferPlanId", "Default transfer plan id"],
    ["urgencyEnabled", "Urgency rules enabled"],
    ["callbackRequestsEnabled", "Callback requests enabled"],
    ["callbackRequiredCollectFieldIds", "Callback required collect field ids"],
    ["callbackUseAniByDefault", "Callback use ANI"],
    ["callbackAskPreferredTime", "Callback ask preferred time"],
    ["callbackConfirmNumber", "Callback confirm number"],
    ["salesSolicitationEnabled", "Sales solicitation enabled"],
    ["salesSolicitationAction", "Sales solicitation action"],
  ];
  for (const [path, label] of callHandlingScalars) {
    rows.push(
      row({
        step: 5,
        uiLabel: label,
        statePath: path,
        valueType: "varies",
        v3ConfigPath: `callHandling.* + transferDestinations[]`,
        destinations: ["DETERMINISTIC_CONFIG", "PROVIDER_CONFIG", "ASTRA_BACKEND_CONTEXT"],
        executionStatus:
          path.startsWith("transfer") ||
          path === "callbackRequestsEnabled" ||
          path === "callbackRequiredCollectFieldIds"
            ? "ACTIVE_EXECUTION"
            : path === "detectVoicemailOnTransfer"
              ? "DEFERRED_NOT_EXPOSED"
              : "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "compileVoiceV3AgentConfig.callHandling",
        runtimeConsumer:
          path === "callbackRequiredCollectFieldIds"
            ? "request_callback requirements"
            : "transfer_call executor",
        republishBehavior: "next_call",
        testCoverage:
          path === "transferDestinations" || path === "callbackRequiredCollectFieldIds"
            ? "test-voice-v3-wizard-compiler"
            : undefined,
      }),
    );
  }

  for (const field of TRANSFER_DEST_FIELDS) {
    rows.push(
      row({
        step: 5,
        uiLabel: `Transfer destination ${field}`,
        statePath: `transferDestinations[].${field}`,
        valueType: "varies",
        v3ConfigPath: `transferDestinations[].${field}`,
        destinations: ["DETERMINISTIC_CONFIG", "ASTRA_BACKEND_CONTEXT", "PROVIDER_CONFIG"],
        executionStatus: "ACTIVE_EXECUTION",
        scope: "YES_GENERAL",
        compilerFunction: "transferDestinationsFromWizard",
        runtimeConsumer: "transfer_call enum + executor",
        republishBehavior: "next_call",
      }),
    );
  }

  for (const field of TRANSFER_PLAN_FIELDS) {
    rows.push(
      row({
        step: 5,
        uiLabel: `Transfer plan step ${field}`,
        statePath: `transferPlanSteps[].${field}`,
        valueType: "varies",
        v3ConfigPath: `callHandling.transferPlanSteps[].${field}`,
        destinations: ["DETERMINISTIC_CONFIG", "PROVIDER_CONFIG"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "YES_GENERAL",
        compilerFunction: "compileVoiceV3AgentConfig.callHandling",
        runtimeConsumer: "future waterfall transfer",
        republishBehavior: "next_call",
      }),
    );
  }

  const recoveryFields = [
    "aiCallRecoveryEnabled",
    "aiCallRecoveryConsentMode",
    "aiCallRecoverySendingPhoneNumberId",
    "aiCallRecoveryContinueOverSms",
    "aiCallRecoveryDelaySeconds",
    "aiCallRecoverySendWhenCallbackCreated",
  ] as const;
  for (const path of recoveryFields) {
    rows.push(
      row({
        step: 5,
        uiLabel: path,
        statePath: path,
        valueType: "varies",
        v3ConfigPath: "recovery.*",
        destinations: ["DETERMINISTIC_CONFIG"],
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
        scope: "FUTURE_EXECUTION",
        compilerFunction: "compileVoiceV3AgentConfig.recovery",
        runtimeConsumer: "AI call recovery SMS (future)",
        republishBehavior: "next_call",
      }),
    );
  }

  const voiceScalars: Array<[string, string, WizardV3ExecutionStatus, string]> = [
    ["agentName", "Agent name", "ACTIVE_EXECUTION", "identity.agentName"],
    ["businessName", "Business name (voice step)", "ACTIVE_EXECUTION", "businessName"],
    ["role", "Role", "ACTIVE_EXECUTION", "conversation.role"],
    ["tone", "Tone", "ACTIVE_EXECUTION", "conversation.tone"],
    ["speakingStyle", "Speaking style", "ACTIVE_EXECUTION", "conversation.speakingStyle"],
    ["language", "Language", "ACTIVE_EXECUTION", "conversation.language"],
    ["speaksFirst", "Speaks first", "ACTIVE_EXECUTION", "conversation.speaksFirst"],
    ["openingGreeting", "Opening greeting", "ACTIVE_EXECUTION", "conversation.openingGreeting"],
    ["voiceId", "Voice id", "ACTIVE_EXECUTION", "telephony.liveVoiceId"],
    ["voiceLabel", "Voice label", "CONTROL_PLANE_ONLY", "telephony.voiceLabel"],
    ["speakingPace", "Speaking pace", "LIVE_PROMPT_CONTROL", "conversation.livePromptControls.speakingPace"],
    ["voiceAccent", "Accent / dialect", "LIVE_PROMPT_CONTROL", "conversation.livePromptControls.voiceAccent"],
    ["backchannelLevel", "Backchannel level", "LIVE_PROMPT_CONTROL", "conversation.livePromptControls.backchannelLevel"],
    ["callerPausePatience", "Caller pause patience", "LIVE_PROMPT_CONTROL", "conversation.livePromptControls.callerPausePatience"],
    ["interruptionStyle", "Interruption style", "LIVE_PROMPT_CONTROL", "conversation.livePromptControls.interruptionStyle"],
    ["voiceSource", "Voice source", "CONTROL_PLANE_ONLY", "telephony.voiceSource"],
    ["openAiCustomVoiceId", "Custom OpenAI voice id", "CONTROL_PLANE_ONLY", "telephony.openAiCustomVoiceId"],
  ];
  for (const [path, label, exec, v3] of voiceScalars) {
    rows.push(
      row({
        step: 6,
        uiLabel: label,
        statePath: path,
        valueType: "varies",
        v3ConfigPath: v3,
        destinations:
          exec === "LIVE_PROMPT_CONTROL"
            ? ["LIVE_FRONTEND_CONTEXT"]
            : exec === "CONTROL_PLANE_ONLY"
              ? ["CONTROL_PLANE_ONLY"]
              : ["LIVE_FRONTEND_CONTEXT", "PROVIDER_CONFIG"],
        executionStatus: exec,
        scope: "YES_GENERAL",
        compilerFunction:
          exec === "LIVE_PROMPT_CONTROL"
            ? "resolveLivePromptControlsFromWizard + buildLivePromptControlsInstructionBlock"
            : "compileVoiceV3AgentConfig.conversation/telephony",
        runtimeConsumer:
          exec === "LIVE_PROMPT_CONTROL"
            ? "GPT-Live instructions (prompt-controlled)"
            : exec === "CONTROL_PLANE_ONLY"
              ? "Wizard UI only"
              : "Live accept + Amy",
        republishBehavior: "next_call",
        testCoverage: path === "agentName" || path === "openingGreeting" || path === "voiceId"
          ? "test-voice-v3-wizard-compiler"
          : undefined,
      }),
    );
  }

  for (const key of CONVERSATION_BEHAVIOR_KEYS) {
    rows.push(
      row({
        step: 6,
        uiLabel: `Conversation behavior: ${key}`,
        statePath: `conversationBehaviors.${key}`,
        valueType: "boolean",
        v3ConfigPath: `conversation.conversationBehaviors.${key}`,
        destinations: ["LIVE_FRONTEND_CONTEXT"],
        executionStatus: "ACTIVE_EXECUTION",
        scope: "YES_GENERAL",
        compilerFunction: "compileVoiceV3AgentConfig.conversation",
        runtimeConsumer: "Amy instructions",
        republishBehavior: "next_call",
      }),
    );
  }

  rows.push(
    row({
      step: 6,
      uiLabel: "Guardrails",
      statePath: "guardrails[]",
      valueType: "string (repeatable item)",
      v3ConfigPath: "conversation.guardrails[]",
      destinations: ["LIVE_FRONTEND_CONTEXT"],
      executionStatus: "ACTIVE_EXECUTION",
      scope: "YES_GENERAL",
      compilerFunction: "compileVoiceV3AgentConfig.conversation",
      runtimeConsumer: "Amy instructions",
      republishBehavior: "next_call",
    }),
  );

  rows.push(
    row({
      step: 7,
      uiLabel: "Test scenario",
      statePath: "testScenario",
      valueType: "TestScenarioId",
      v3ConfigPath: "controlPlane.testScenario",
      destinations: ["CONTROL_PLANE_ONLY"],
      executionStatus: "CONTROL_PLANE_ONLY",
      scope: "CONTROL_PLANE",
      compilerFunction: "compileVoiceV3AgentConfig.controlPlane",
      runtimeConsumer: "wizard test UI",
      republishBehavior: "control_plane_only",
    }),
    row({
      step: 7,
      uiLabel: "Last test passed",
      statePath: "lastTestPassed",
      valueType: "boolean | null",
      v3ConfigPath: "controlPlane.lastTestPassed",
      destinations: ["CONTROL_PLANE_ONLY"],
      executionStatus: "CONTROL_PLANE_ONLY",
      scope: "CONTROL_PLANE",
      compilerFunction: "n/a",
      runtimeConsumer: "wizard UI",
      republishBehavior: "control_plane_only",
    }),
  );

  const activateFields = [
    ["activationMode", "Activation mode"],
    ["scheduledAt", "Scheduled activation time"],
    ["longTermMemory", "Long-term caller memory"],
    ["crmEnabled", "CRM enabled"],
    ["qualityStudioLastRun", "Quality studio last run"],
  ] as const;
  for (const [path, label] of activateFields) {
    rows.push(
      row({
        step: 8,
        uiLabel: label,
        statePath: path,
        valueType: "varies",
        v3ConfigPath:
          path === "crmEnabled" || path === "longTermMemory"
            ? "integrations.*"
            : "controlPlane.*",
        destinations: ["CONTROL_PLANE_ONLY", "DETERMINISTIC_CONFIG"],
        executionStatus:
          path === "crmEnabled" ? "CONFIGURED_NOT_IMPLEMENTED" : "CONTROL_PLANE_ONLY",
        scope: path === "crmEnabled" ? "FUTURE_CRM" : "CONTROL_PLANE",
        compilerFunction: "compileVoiceV3AgentConfig",
        runtimeConsumer: path === "crmEnabled" ? "future CRM tools" : "workspace",
        republishBehavior: "control_plane_only",
      }),
    );
  }

  const metaFields = [
    ["agentId", "Agent id"],
    ["setupId", "Setup id"],
    ["outcomeSlug", "Outcome slug"],
    ["preset", "URL preset"],
    ["telnyxAssistantId", "Telnyx assistant id"],
  ] as const;
  for (const [path, label] of metaFields) {
    rows.push(
      row({
        step: 0,
        uiLabel: label,
        statePath: path,
        valueType: "string",
        v3ConfigPath: "controlPlane.meta.*",
        destinations: ["CONTROL_PLANE_ONLY"],
        executionStatus: "CONTROL_PLANE_ONLY",
        scope: "CONTROL_PLANE",
        compilerFunction: "n/a",
        runtimeConsumer: "persistence",
        republishBehavior: "control_plane_only",
      }),
    );
  }

  return applyLaunchClassificationToManifest(rows);
}

export function summarizeWizardV3Manifest(rows: WizardV3FieldManifestRow[]) {
  const totals: Record<string, number> = {
    total: rows.length,
    WIRED_V3_CONFIG: rows.length,
    ACTIVE_EXECUTION: 0,
    LIVE_PROMPT_CONTROL: 0,
    ACTIVE_CONTROL_PLANE: 0,
    CONFIGURED_NOT_IMPLEMENTED: 0,
    CONTROL_PLANE_ONLY: 0,
    OUT_OF_SCOPE_RETIRED: 0,
    UI_METADATA_ONLY: 0,
    HIDDEN_STATE_ONLY: 0,
    MCTB_ONLY: 0,
    LEGACY_OBSOLETE: 0,
    PROVIDER_CONFIG: 0,
    UNSUPPORTED_BY_CURRENT_LIVE_API: 0,
    unmapped: 0,
  };
  for (const r of rows) {
    if (totals[r.executionStatus] !== undefined) {
      totals[r.executionStatus] += 1;
    } else {
      totals.unmapped += 1;
    }
  }
  return totals;
}
