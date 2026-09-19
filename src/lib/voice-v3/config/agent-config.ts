import type { BusinessHoursWindow, VoiceV3CalendarConfig } from "../calendar/types";

export type IntakeFieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "time";

export type IntakeCollectionStrategy =
  | "standard"
  | "voice_email"
  | "voice_phone"
  | "voice_address"
  | "voice_date";

export interface IntakeFieldDefinition {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  /** Model-facing semantic description — required for production agents. */
  description: string;
  collectionStrategy?: IntakeCollectionStrategy;
  verificationRequired?: boolean;
}

export interface VoiceV3IntakeConfig {
  objectiveDescription?: string;
}

export type VoiceOperationRequirementKey =
  | "find_availability"
  | "book_appointment"
  | "find_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "transfer_call";

export interface VoiceV3ServiceConfig {
  id: string;
  name: string;
  durationMinutes: number;
  slotStepMinutes: number;
}

export interface VoiceV3AgentConfig {
  businessName: string;
  timezone: string;
  intake?: VoiceV3IntakeConfig;
  intakeFields: IntakeFieldDefinition[];
  operationRequirements?: Partial<Record<VoiceOperationRequirementKey, string[]>>;
  service: VoiceV3ServiceConfig;
  businessHours: BusinessHoursWindow;
  calendar?: VoiceV3CalendarConfig | null;
}
