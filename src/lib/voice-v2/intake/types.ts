import type {
  IntakeFieldKey,
  IntakeRequirementLevel,
  VoiceV2IntakeWizardConfig,
} from "./wizard-config";

export type { IntakeFieldKey, IntakeRequirementLevel, VoiceV2IntakeWizardConfig };
export {
  BUILTIN_INTAKE_FIELD_KEYS,
  INTAKE_FIELD_KEYS,
  type BuiltinIntakeFieldKey,
} from "./wizard-config";

export type IntakeFieldStatus =
  | "MISSING"
  | "PREFILLED"
  | "CAPTURED"
  | "CONFIRMED"
  | "CORRECTED";

export type IntakeFieldSource = "CALLER" | "CALLER_ID" | "TRANSCRIPT_RECOVERY" | "SYSTEM";

export interface IntakeFieldValue {
  value: string;
  status: IntakeFieldStatus;
  source: IntakeFieldSource;
  updatedAt: string;
}

export type VoiceV2IntakeState = Record<string, IntakeFieldValue>;

export type IntakeFieldValueType = "text" | "phone" | "email" | "address";

export interface CompiledIntakeField {
  key: IntakeFieldKey;
  enabled: true;
  requirementLevel: IntakeRequirementLevel;
  label: string;
  questionText: string;
  valueType: IntakeFieldValueType;
}

export interface VoiceV2IntakeSchema {
  fields: CompiledIntakeField[];
}

export interface AskedFieldMemory {
  count: number;
  lastAskedAt: string;
}

import type { VoiceV2BookingWorkflow } from "../booking-workflow";
import type {
  VoiceV2QualificationRuleRow,
  VoiceV2QualificationState,
  VoiceV2QualificationFallbackAction,
  VoiceV2QualificationRuleMatchMode,
} from "../qualification-types";

export interface VoiceV2CallContext {
  sessionKey: string;
  workspaceId: string;
  agentId: string;
  /** Inbound PSTN ANI — never replaced when caller gives a different callback number. */
  callerAniE164?: string | null;
  businessTimezone: string;
  intakeSchema: VoiceV2IntakeSchema;
  intakeState: VoiceV2IntakeState;
  askedFields: Partial<Record<IntakeFieldKey, AskedFieldMemory>>;
  currentOfferSet?: { offerSetId: string; slotIds: string[] };
  bookingState?: { selectedSlotId?: string; status?: string };
  bookingWorkflow?: VoiceV2BookingWorkflow;
  /** Observability: intake saves this call (in-memory). */
  intakeSaveCount?: number;
  compiledAt: string;
  /** Pinned capabilities from enrollment / L2 record (warm tool path). */
  capabilities?: {
    voiceV2PstnLiveBooking?: boolean;
    bookingStrategy?: import("../booking-strategy").VoiceV2BookingStrategy;
    bookingEnabled?: boolean;
    intakeEnabled?: boolean;
    rescheduleEnabled?: boolean;
    cancelEnabled?: boolean;
    knowledgeBaseEnabled?: boolean;
    knowledgeBaseRevision?: string;
    knowledgeBaseIds?: string[];
    qualificationEnabled?: boolean;
    qualificationRequiredBeforePrimaryAction?: boolean;
    qualificationRevision?: string;
    qualificationRules?: VoiceV2QualificationRuleRow[];
    qualificationRulesMatchMode?: VoiceV2QualificationRuleMatchMode;
    qualificationSupportedZipCodes?: string[];
    qualificationNotQualifiedFallback?: VoiceV2QualificationFallbackAction;
    qualificationNeedsReviewFallback?: VoiceV2QualificationFallbackAction;
    qualificationFieldKeys?: string[];
    afterHoursHandling?: import("../after-hours-handling-types").VoiceV2PublishedAfterHoursHandlingConfig;
    transferToolAvailable?: boolean;
    callbackToolAvailable?: boolean;
    /** Pinned wizard revision for intake schema — post-call reconciliation uses this. */
    intakeSchemaRevision?: string;
  };
  qualification?: VoiceV2QualificationState;
  appointmentAction?: import("../appointment-changes/ref-store").VoiceV2AppointmentActionState;
  afterHours?: import("../after-hours-handling-types").VoiceV2AfterHoursRuntimeState;
}

export interface IntakeReadinessResult {
  missingBeforeBooking: IntakeFieldKey[];
  missingForRecord: IntakeFieldKey[];
  satisfied: IntakeFieldKey[];
}
