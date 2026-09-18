import type { BusinessHoursWindow, VoiceV3CalendarConfig } from "../calendar/types";

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

export interface VoiceV3ServiceConfig {
  durationMinutes: number;
  slotStepMinutes: number;
}

export interface VoiceV3AgentConfig {
  businessName: string;
  timezone: string;
  intakeFields: IntakeFieldDefinition[];
  service: VoiceV3ServiceConfig;
  businessHours: BusinessHoursWindow;
  calendar?: VoiceV3CalendarConfig | null;
}
