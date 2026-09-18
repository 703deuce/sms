export type IntakeFieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "time";

export interface IntakeFieldDefinition {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  description?: string;
}

export interface VoiceV3AgentConfig {
  businessName: string;
  timezone: string;
  intakeFields: IntakeFieldDefinition[];
}
