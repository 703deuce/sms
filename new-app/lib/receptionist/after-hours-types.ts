/** Urgency + transfer types for Voice V3 runtime (new-app local). */

export type VoiceV2DeterministicOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "IN"
  | "NOT_IN"
  | "EXISTS"
  | "NOT_EXISTS"
  | "CONTAINS"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL";

export type VoiceV2HandlingAction =
  | "CONTINUE"
  | "TAKE_MESSAGE"
  | "CALLBACK"
  | "REQUEST_ONLY"
  | "SEND_LINK"
  | "TRANSFER"
  | "END_POLITELY";

export type VoiceV2FallbackAction =
  | "CONTINUE_WITH_AMY"
  | "TAKE_MESSAGE"
  | "CALLBACK"
  | "REQUEST_ONLY"
  | "SEND_LINK";

export type VoiceV2UrgencyRuleRow = {
  id: string;
  label?: string;
  fieldKey: string;
  operator: VoiceV2DeterministicOperator;
  value: string;
  severity: "URGENT" | "CRITICAL";
  action: VoiceV2HandlingAction;
  transferPlanId?: string | null;
  fallbackAction?: VoiceV2FallbackAction | null;
};
