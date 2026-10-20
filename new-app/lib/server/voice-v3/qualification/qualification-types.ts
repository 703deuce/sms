/** Voice V3 lead qualification types (new-app local — not legacy wizard). */

export type VoiceV2QualificationStatus =
  | "UNKNOWN"
  | "QUALIFIED"
  | "NOT_QUALIFIED"
  | "NEEDS_REVIEW";

export type VoiceV2QualificationReasonCode =
  | "OUTSIDE_SERVICE_AREA"
  | "UNSUPPORTED_SERVICE"
  | "BUDGET_BELOW_MINIMUM"
  | "PROPERTY_TYPE_UNSUPPORTED"
  | "MISSING_INFORMATION"
  | "RULE_MATCH"
  | "OTHER_CONFIGURED_RULE";

export type VoiceV2QualificationOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "IN"
  | "NOT_IN"
  | "EXISTS"
  | "NOT_EXISTS"
  | "CONTAINS"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL";

export type VoiceV2QualificationRuleMatchMode = "ALL" | "ANY";

export type VoiceV2QualificationRuleRow = {
  id: string;
  fieldKey: string;
  operator: VoiceV2QualificationOperator;
  value: string;
  resultStatus: "QUALIFIED" | "NOT_QUALIFIED" | "NEEDS_REVIEW";
  reasonCode?: VoiceV2QualificationReasonCode;
  reasonLabel?: string;
};
