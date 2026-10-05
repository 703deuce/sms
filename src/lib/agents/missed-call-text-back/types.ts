export type InboundCallClassification =
  | "answered"
  | "missed_no_answer"
  | "missed_busy"
  | "missed_rejected"
  | "missed_timeout"
  | "missed_failed"
  | "voicemail"
  | "abandoned"
  | "outbound"
  | "unknown";

export type MissedCallEventStatus =
  | "DETECTED"
  | "ELIGIBILITY_CHECK"
  | "SUPPRESSED"
  | "SCHEDULED"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "WAITING_FOR_REPLY"
  | "CUSTOMER_REPLIED";

export type MctbSuppressionReason =
  | "FEATURE_DISABLED"
  | "CALL_ANSWERED"
  | "OUTBOUND_CALL"
  | "NOT_MISSED"
  | "UNKNOWN_CALLER"
  | "INVALID_PHONE"
  | "OPTED_OUT"
  | "BLOCKED_NUMBER"
  | "SPAM"
  | "COOLDOWN_ACTIVE"
  | "ALREADY_SENT"
  | "OUTSIDE_SEND_WINDOW"
  | "NOT_SMS_CAPABLE"
  | "PROVIDER_ERROR"
  | "TRIGGER_DISABLED"
  | "ENTITLEMENT_SUSPENDED"
  | "TRIAL_SMS_LIMIT"
  | "MESSAGING_NOT_APPROVED"
  | "NOT_EXISTING_CONSENT"
  | "MISSING_ATTESTATION"
  | "MCTB_DISABLED"
  | "DUPLICATE"
  | "INVALID_CALLER"
  | "WORKSPACE_INACTIVE"
  | "NOT_FORWARD_EVENT";

export type MctbSenderMode = "WORKSPACE" | "PLATFORM";

export type MissedCallTextConfigRecord = {
  id: string;
  workspaceId: string;
  agentId: string | null;
  enabled: boolean;
  delaySeconds: number;
  messageTemplate: string;
  sendAfterNoAnswer: boolean;
  sendAfterBusy: boolean;
  sendAfterRejected: boolean;
  sendAfterTimeout: boolean;
  sendAfterVoicemail: boolean;
  businessHoursOnly: boolean;
  allowedStartTime: string | null;
  allowedEndTime: string | null;
  timezone: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  maxMessagesPerCaller: number;
  cooldownMinutes: number;
  suppressKnownSpam: boolean;
  suppressBlockedNumbers: boolean;
  suppressOptedOutNumbers: boolean;
  conversationEnabled: boolean;
  phoneNumberId: string | null;
  smsPhoneNumberId: string | null;
  senderMode: MctbSenderMode;
  messageTemplateBusinessHours?: string | null;
  messageTemplateAfterHours?: string | null;
  requireCarrierForward?: boolean;
  directDialForwardE164?: string | null;
  requestFormEnabled?: boolean;
  requestFormToken?: string | null;
  defaultLinkUrl?: string | null;
  leadCaptureEnabled?: boolean;
  requestFormFieldsJson?: unknown;
  /** Workspace customFieldsConfig.mctb — not a DB column on missedCallTextConfig */
  platformRecoveryTemplateId?: string | null;
  firstTextTemplate?: import("@/lib/mctb/first-text-templates/types").MctbFirstTextTemplateConfig | null;
};

export type MissedCallTextSettingsUpdate = {
  enabled?: boolean;
  delay_seconds?: number;
  initial_message?: string;
  trigger_rules?: {
    no_answer?: boolean;
    busy?: boolean;
    rejected?: boolean;
    timeout?: boolean;
    voicemail?: boolean;
  };
  quiet_hours?: {
    enabled: boolean;
    start?: string;
    end?: string;
  };
  cooldown_minutes?: number;
  max_messages_per_caller?: number;
  phone_number_id?: string | null;
  sms_phone_number_id?: string | null;
  sender_mode?: MctbSenderMode;
  message_template_business_hours?: string | null;
  message_template_after_hours?: string | null;
  require_carrier_forward?: boolean;
  direct_dial_forward_e164?: string | null;
  request_form_enabled?: boolean;
  request_form_token?: string | null;
  default_link_url?: string | null;
  lead_capture_enabled?: boolean;
  request_form_fields_json?: unknown;
};

export const DEFAULT_MCTB_MESSAGE =
  "Hi, sorry we missed your call. How can we help?";

export const DEFAULT_MCTB_CONFIG: Omit<
  MissedCallTextConfigRecord,
  "id" | "workspaceId"
> = {
  agentId: null,
  enabled: true,
  delaySeconds: 20,
  messageTemplate: DEFAULT_MCTB_MESSAGE,
  sendAfterNoAnswer: true,
  sendAfterBusy: true,
  sendAfterRejected: true,
  sendAfterTimeout: true,
  sendAfterVoicemail: false,
  businessHoursOnly: false,
  allowedStartTime: null,
  allowedEndTime: null,
  timezone: "America/New_York",
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  maxMessagesPerCaller: 1,
  cooldownMinutes: 60,
  suppressKnownSpam: true,
  suppressBlockedNumbers: true,
  suppressOptedOutNumbers: true,
  conversationEnabled: true,
  phoneNumberId: null,
  smsPhoneNumberId: null,
  senderMode: "PLATFORM",
  messageTemplateBusinessHours: null,
  messageTemplateAfterHours: null,
  requireCarrierForward: false,
  directDialForwardE164: null,
  requestFormEnabled: false,
  requestFormToken: null,
  defaultLinkUrl: null,
  leadCaptureEnabled: false,
  requestFormFieldsJson: null,
};
