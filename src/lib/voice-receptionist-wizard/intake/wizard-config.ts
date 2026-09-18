/** Shared intake types (client + server safe). */

export type IntakeRequirementLevel =
  | "OPTIONAL"
  | "REQUIRED_FOR_RECORD"
  | "REQUIRED_BEFORE_BOOKING";

/** Built-in keys plus any wizard-defined custom field id (e.g. mothers_name). */
export type IntakeFieldKey = string;

export type BuiltinIntakeFieldKey =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "service_reason";

export const BUILTIN_INTAKE_FIELD_KEYS: BuiltinIntakeFieldKey[] = [
  "name",
  "email",
  "phone",
  "address",
  "service_reason",
];

/** @deprecated Use BUILTIN_INTAKE_FIELD_KEYS for built-ins only. */
export const INTAKE_FIELD_KEYS: BuiltinIntakeFieldKey[] = BUILTIN_INTAKE_FIELD_KEYS;

export type VoiceV2IntakeWizardConfig = {
  fields: Partial<
    Record<
      IntakeFieldKey,
      {
        enabled?: boolean;
        requirementLevel?: IntakeRequirementLevel;
        label?: string;
        questionText?: string;
      }
    >
  >;
};
