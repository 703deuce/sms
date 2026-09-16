/** Shared Voice V2 lead qualification types (client + server safe). */

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

export type VoiceV2QualificationFallbackAction =
  | "TAKE_MESSAGE"
  | "REQUEST_APPOINTMENT"
  | "SEND_BOOKING_LINK"
  | "CONTINUE_PRIMARY_MODE";

export type VoiceV2QualificationRuleRow = {
  id: string;
  fieldKey: string;
  operator: VoiceV2QualificationOperator;
  /** Comma-separated or single value depending on operator */
  value: string;
  /** When this rule's condition matches */
  resultStatus: "QUALIFIED" | "NOT_QUALIFIED" | "NEEDS_REVIEW";
  reasonCode?: VoiceV2QualificationReasonCode;
  reasonLabel?: string;
};

export type VoiceV2PublishedQualificationConfig = {
  qualificationEnabled: boolean;
  qualificationRequiredBeforePrimaryAction: boolean;
  qualificationRevision: string;
  rules: VoiceV2QualificationRuleRow[];
  rulesMatchMode: VoiceV2QualificationRuleMatchMode;
  supportedZipCodes: string[];
  notQualifiedFallback: VoiceV2QualificationFallbackAction;
  needsReviewFallback: VoiceV2QualificationFallbackAction;
  /** Intake keys that participate in qualification (from callerFields metadata) */
  qualificationFieldKeys: string[];
};

export type VoiceV2QualificationState = {
  status: VoiceV2QualificationStatus;
  reasonCode?: VoiceV2QualificationReasonCode;
  reasonLabel?: string;
  revision: string;
  evaluatedAt: string;
  /** When gate blocks live booking / link */
  primaryActionBlocked?: boolean;
};
