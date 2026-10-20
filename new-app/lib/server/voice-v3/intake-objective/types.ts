import type {
  IntakeCollectionStrategy,
  IntakeFieldDefinition,
  VoiceV3AgentConfig,
} from "../config/agent-config";
import type { CapturedField } from "../state/call-context";

export type IntakeObjectiveStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export type IntakeFieldStatus =
  | "MISSING"
  | "CANDIDATE"
  | "COLLECTED"
  | "VERIFIED"
  | "DECLINED";

export interface IntakeFieldState {
  key: string;
  label: string;
  required: boolean;
  collectionStrategy: IntakeCollectionStrategy;
  verificationRequired: boolean;
  status: IntakeFieldStatus;
  revision: number;
  hasValue: boolean;
}

export interface IntakeObjectiveState {
  status: IntakeObjectiveStatus;
  requiredFields: string[];
  optionalFields: string[];
  collectedFields: string[];
  missingRequiredFields: string[];
  fields: IntakeFieldState[];
}

export type IntakeFieldRejectionCode =
  | "INVALID_FORMAT"
  | "INVALID_ENUM"
  | "EMPTY_VALUE"
  | "UNKNOWN_FIELD"
  | "STALE_FIELD_CONFIRMATION";

export interface IntakeFieldRejection {
  field: string;
  code: IntakeFieldRejectionCode;
  message: string;
}

export interface MergeIntakeUpdateInput {
  current: Record<string, CapturedField>;
  update: Record<string, string | null | undefined>;
  config: VoiceV3AgentConfig;
  at: Date;
  sourceCallId: string;
  sourceDelegationId: string | null;
}

export interface MergeIntakeUpdateResult {
  values: Record<string, CapturedField>;
  updatedFields: string[];
  rejectedFields: IntakeFieldRejection[];
  fieldsChanged: string[];
}

export function defaultCollectionStrategy(
  field: IntakeFieldDefinition,
): IntakeCollectionStrategy {
  if (field.collectionStrategy) return field.collectionStrategy;
  if (field.type === "email") return "voice_email";
  if (field.type === "phone") return "voice_phone";
  if (field.type === "date") return "voice_date";
  return "standard";
}

export function fieldDefinitionByKey(
  config: VoiceV3AgentConfig,
  key: string,
): IntakeFieldDefinition | undefined {
  return config.intakeFields.find((f) => f.key === key);
}
