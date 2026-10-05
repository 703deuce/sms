/** Deterministic first recovery SMS templates (platform-controlled copy + variable slots). */
export const MCTB_FIRST_TEXT_TEMPLATE_VERSION = 1;

export type MctbFirstTextTemplateId =
  | "on_a_job"
  | "quick_question"
  | "callback_time"
  | "what_do_you_need"
  | "simple";

export type MctbCallbackTimePreset =
  | "within_10_minutes"
  | "within_15_minutes"
  | "within_30_minutes"
  | "within_1_hour"
  | "as_soon_as_possible"
  | "when_we_reopen_tomorrow_morning"
  | "custom";

export type MctbCallbackTimeVariable = {
  preset: MctbCallbackTimePreset;
  customText?: string | null;
};

export type MctbFirstTextTemplateVariables = {
  callbackTime?: MctbCallbackTimeVariable | null;
  callbackTimeAfterHours?: MctbCallbackTimeVariable | null;
  service1?: string | null;
  service2?: string | null;
};

export type MctbFirstTextTemplateConfig = {
  templateId: MctbFirstTextTemplateId;
  version: number;
  variables: MctbFirstTextTemplateVariables;
};

export type MctbFirstTextTemplateDefinition = {
  id: MctbFirstTextTemplateId;
  name: string;
  purpose: string;
  body: string;
  requiredVariables: Array<keyof MctbFirstTextTemplateVariables | "business_name">;
  usesCallbackTime: boolean;
};
