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

export type IntakeFieldValueType = "text" | "phone" | "email" | "address";

export interface CompiledIntakeField {
  key: string;
  enabled: true;
  requirementLevel: IntakeRequirementLevel;
  label: string;
  questionText: string;
  valueType: IntakeFieldValueType;
}

export interface VoiceV2IntakeSchema {
  fields: CompiledIntakeField[];
}
