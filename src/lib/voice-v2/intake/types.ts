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

export interface VoiceV2CallContext {
  sessionKey: string;
  workspaceId: string;
  agentId: string;
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
    bookingEnabled?: boolean;
    intakeEnabled?: boolean;
  };
}

export interface IntakeReadinessResult {
  missingBeforeBooking: IntakeFieldKey[];
  missingForRecord: IntakeFieldKey[];
  satisfied: IntakeFieldKey[];
}
