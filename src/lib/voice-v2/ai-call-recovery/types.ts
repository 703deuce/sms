import type { VoiceV2PrimaryOutcome } from "../primary-outcome";

/** Separate from primary outcome — whether the caller's intended task was finished. */
export type VoiceV2ResolutionStatus =
  | "RESOLVED_SUCCESS"
  | "RESOLVED_INFORMATION_ONLY"
  | "PARTIALLY_RESOLVED"
  | "UNRESOLVED_ABANDONED"
  | "UNRESOLVED_PROVIDER_FAILURE"
  | "UNRESOLVED_TRANSFER_FAILURE"
  | "DECLINED_AI_CHANNEL"
  | "NON_CUSTOMER_CALL";

export type VoiceV2RecoveryDeliveryDecision =
  | "SEND_RECOVERY_SMS"
  | "SEND_CONFIRMATION_SMS"
  | "SEND_CALLBACK_ACK_SMS"
  | "SEND_FAILURE_FALLBACK_SMS"
  | "NO_SMS";

export type VoiceV2RecoverySubtype =
  | "SILENT_ABANDONMENT"
  | "PARTIAL_INTAKE"
  | "BOOKING_INTERRUPTED"
  | "PROVIDER_FAILURE"
  | "TRANSFER_INTERRUPTED"
  | "TRANSFER_FAILED"
  | "AI_CHANNEL_DECLINED"
  | "GENERAL_UNRESOLVED";

export type VoiceV2AiCallRecoveryConsentMode =
  | "DISABLED"
  | "EXISTING_CONSENT"
  | "PLATFORM_CAPTURED_CONSENT";

export type VoiceV2AiCallRecoveryTemplates = {
  silentAbandonment: string;
  partialIntake: string;
  bookingInterrupted: string;
  transferInterrupted: string;
  providerFailure: string;
  aiChannelDeclined: string;
  generalUnresolved: string;
};

export type VoiceV2AiCallRecoveryTriggers = {
  silentAbandonment: boolean;
  partialIntake: boolean;
  bookingInterrupted: boolean;
  providerFailure: boolean;
  transferInterrupted: boolean;
  transferFailed: boolean;
  declinedAi: boolean;
  generalUnresolved: boolean;
};

export type VoiceV2AiCallRecoveryConfig = {
  enabled: boolean;
  consentMode: VoiceV2AiCallRecoveryConsentMode;
  sendingPhoneNumberId: string | null;
  continueOverSms: boolean;
  triggers: VoiceV2AiCallRecoveryTriggers;
  sendWhenCallbackAlreadyCreated: boolean;
  delaySeconds: number;
  templates: VoiceV2AiCallRecoveryTemplates;
  /** Optional after-hours template/behavior variant — does not affect call routing. */
  afterHoursRecoveryEnabled?: boolean;
  /** Contact-level cooldown between automatic recovery texts (seconds). */
  recoveryCooldownSeconds?: number;
};

export type VoiceV2PinnedSchemaSnapshot = {
  captured_fields: string[];
  captured_custom_fields: string[];
  missing_required_for_record: string[];
  missing_required_before_booking: string[];
  qualification_field_keys: string[];
  urgency_field_keys: string[];
  booking_prerequisite_field_keys: string[];
};

export type VoiceV2RecoveryTranscriptTurn = {
  role: "caller" | "agent" | "system";
  text: string;
  at?: string;
};

export type VoiceV2RecoveryActionTimelineEntry = {
  kind: string;
  summary: string;
  at?: string;
};

export type VoiceV2RecoveryStructuredState = {
  primaryOutcome: VoiceV2PrimaryOutcome;
  resolutionStatus: VoiceV2ResolutionStatus;
  recoverySubtype?: VoiceV2RecoverySubtype;
  callerFields: Record<string, string>;
  customFields: Record<string, string>;
  customerStatus?: string;
  qualificationStatus?: string;
  urgencyStatus?: string;
  schedulingPreference?: Record<string, string>;
  booking?: {
    provider?: string;
    strategy?: string;
    offerSetId?: string;
    selectedSlotId?: string;
    bookingStatus?: string;
  };
  transferState?: Record<string, unknown>;
  callbackState?: Record<string, unknown>;
  unresolvedAction?: string;
  configRevision?: string;
  pinnedSchema?: VoiceV2PinnedSchemaSnapshot;
};

export type VoiceV2RecoveryEvaluationInput = {
  callState: {
    isTest?: boolean;
    isSpam?: boolean;
    durationSeconds?: number;
    callerSpeechMeaningful?: boolean;
    declinedAiChannel?: boolean;
    informationOnlyResolved?: boolean;
  };
  resolutionStatus: VoiceV2ResolutionStatus;
  primaryOutcome: VoiceV2PrimaryOutcome;
  disconnectState?: { kind?: string };
  bookingState?: VoiceV2RecoveryStructuredState["booking"];
  transferState?: { status?: string; bridgeSucceeded?: boolean };
  callbackState?: { created?: boolean; success?: boolean };
  callerSpeechState?: { meaningfulUtteranceCount?: number };
  messagingEligibility: {
    recoveryEnabled: boolean;
    consentMode: VoiceV2AiCallRecoveryConsentMode;
    validDestination: boolean;
    validSendingRoute: boolean;
    notOptedOut: boolean;
    notSuppressed: boolean;
    callerIdKnown: boolean;
    recoveryAlreadySent: boolean;
    activeRecoveryCooldown: boolean;
    landlineOrNonSmsDestination: boolean;
  };
  pinnedConfig: VoiceV2AiCallRecoveryConfig;
  recoveryHistory?: { recentRecoveryCount?: number };
  triggers: VoiceV2AiCallRecoveryTriggers;
  sendWhenCallbackAlreadyCreated: boolean;
  partialIntakeEvidence?: boolean;
  providerFailureAuthoritative?: boolean;
  bookingPendingAtHangup?: boolean;
};

export type VoiceV2RecoveryEvaluationResult =
  | { delivery: "NO_SMS"; reason: string }
  | {
      delivery: Exclude<VoiceV2RecoveryDeliveryDecision, "NO_SMS">;
      recoverySubtype?: VoiceV2RecoverySubtype;
      reason: string;
    };

export const VOICE_V2_AI_CALL_RECOVERY_CONTINUATION_SOURCE = "VOICE_CALL";

export const DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES: VoiceV2AiCallRecoveryTemplates = {
  silentAbandonment: "Looks like we got disconnected. How can we help?",
  partialIntake:
    "Looks like we got disconnected. I still have the information you already provided, so you don't need to start over.",
  bookingInterrupted:
    "Looks like we got disconnected while scheduling. We can finish here.",
  transferInterrupted:
    "Looks like we got disconnected while I was connecting you. Would you like me to arrange a callback?",
  providerFailure: "I wasn't able to finish that request by phone. We can keep working on it here.",
  aiChannelDeclined: "No problem — if you'd rather text, you can continue here.",
  generalUnresolved: "Looks like we got disconnected. We can continue here.",
};

export const DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TRIGGERS: VoiceV2AiCallRecoveryTriggers = {
  silentAbandonment: true,
  partialIntake: true,
  bookingInterrupted: true,
  providerFailure: true,
  transferInterrupted: true,
  transferFailed: true,
  declinedAi: true,
  generalUnresolved: false,
};

export const DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG: VoiceV2AiCallRecoveryConfig = {
  enabled: false,
  consentMode: "DISABLED",
  sendingPhoneNumberId: null,
  continueOverSms: true,
  triggers: DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TRIGGERS,
  sendWhenCallbackAlreadyCreated: false,
  delaySeconds: 0,
  templates: DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES,
  recoveryCooldownSeconds: 15 * 60,
};

/** Internal settle window before recovery evaluation (provider races). */
export const VOICE_V2_AI_CALL_RECOVERY_SETTLE_MS_MIN = 3000;
export const VOICE_V2_AI_CALL_RECOVERY_SETTLE_MS_MAX = 8000;
