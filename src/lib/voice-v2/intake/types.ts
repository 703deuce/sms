import type {
  IntakeFieldKey,
  IntakeRequirementLevel,
  VoiceV2IntakeWizardConfig,
} from "./wizard-config";

export type { IntakeFieldKey, IntakeRequirementLevel, VoiceV2IntakeWizardConfig };
export { INTAKE_FIELD_KEYS } from "./wizard-config";

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

export interface VoiceV2IntakeState {
  name?: IntakeFieldValue;
  email?: IntakeFieldValue;
  phone?: IntakeFieldValue;
  address?: IntakeFieldValue;
  service_reason?: IntakeFieldValue;
}

export interface CompiledIntakeField {
  key: IntakeFieldKey;
  enabled: true;
  requirementLevel: IntakeRequirementLevel;
  label: string;
  questionText: string;
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
  compiledAt: string;
}

export interface IntakeReadinessResult {
  missingBeforeBooking: IntakeFieldKey[];
  missingForRecord: IntakeFieldKey[];
  satisfied: IntakeFieldKey[];
}
