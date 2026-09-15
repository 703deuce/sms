/** Shared intake types (client + server safe). */

export type IntakeRequirementLevel =
  | "OPTIONAL"
  | "REQUIRED_FOR_RECORD"
  | "REQUIRED_BEFORE_BOOKING";

export type IntakeFieldKey =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "service_reason";

export const INTAKE_FIELD_KEYS: IntakeFieldKey[] = [
  "name",
  "email",
  "phone",
  "address",
  "service_reason",
];

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
