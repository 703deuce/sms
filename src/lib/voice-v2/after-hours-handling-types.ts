/** Shared after-hours handling types (client + server safe). */

import type { VoiceV2DeterministicOperator } from "./deterministic-rules";

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

export type VoiceV2UrgencyLevel = "UNKNOWN" | "NORMAL" | "URGENT" | "CRITICAL";

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

export type VoiceV2TransferDestinationRow = {
  id: string;
  label: string;
  phoneE164: string;
  enabled: boolean;
};

export type VoiceV2TransferMode = "BASIC" | "WARM";

export type VoiceV2TransferRouting = "SINGLE" | "WATERFALL";

export type VoiceV2TransferPlanStep = {
  order: number;
  destinationId: string;
  transferMode: VoiceV2TransferMode;
  timeoutSeconds?: number;
};

export type VoiceV2TransferPlanRow = {
  id: string;
  label: string;
  enabled: boolean;
  routing: VoiceV2TransferRouting;
  steps: VoiceV2TransferPlanStep[];
  fallbackAction: VoiceV2FallbackAction;
};

export type VoiceV2CallerClassification =
  | "UNKNOWN"
  | "CUSTOMER"
  | "VENDOR_SALES"
  | "SPAM";

export type VoiceV2SalesSolicitationAction =
  | "CONTINUE_NORMALLY"
  | "TAKE_MESSAGE"
  | "DECLINE_POLITELY";

export type VoiceV2PublishedAfterHoursHandlingConfig = {
  revision: string;
  urgencyEnabled: boolean;
  urgencyRules: VoiceV2UrgencyRuleRow[];
  transferEnabled: boolean;
  allowCallerRequestedTransfer: boolean;
  defaultTransferPlanId: string | null;
  transferDestinations: VoiceV2TransferDestinationRow[];
  transferPlans: VoiceV2TransferPlanRow[];
  transferFailureFallback: VoiceV2FallbackAction;
  callbackRequestsEnabled: boolean;
  callbackUseAniByDefault: boolean;
  callbackAskPreferredTime: boolean;
  callbackConfirmNumber: boolean;
  distinguishCustomerStatus: boolean;
  customerStatusFieldKey: string;
  salesSolicitationEnabled: boolean;
  salesSolicitationAction: VoiceV2SalesSolicitationAction;
  classificationFieldKey: string;
};

export type VoiceV2UrgencyState = {
  status: VoiceV2UrgencyLevel;
  reason?: string;
  matchedRuleId?: string;
  evaluatedAt: string;
  stateVersion: number;
  sideEffectGeneration?: string;
};

export type VoiceV2TransferAttemptResult =
  | "INITIATING"
  | "SUCCESS"
  | "NO_ANSWER"
  | "BUSY"
  | "DECLINED"
  | "TIMEOUT"
  | "BRIDGE_FAILED"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "CALLER_DISCONNECTED"
  | "STALE_EVENT";

export type VoiceV2TransferStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "INITIATING"
  | "SUCCEEDED"
  | "FAILED";

export type VoiceV2TransferSessionState = {
  status: VoiceV2TransferStatus;
  transferGeneration: number;
  planId?: string;
  currentStepOrder?: number;
  currentDestinationId?: string;
  lastResult?: VoiceV2TransferAttemptResult;
  invocationId?: string;
  updatedAt: string;
};

export type VoiceV2CallbackState = {
  requested: boolean;
  callbackNumber?: string;
  callbackPreference?: string;
  finalizedAt?: string;
  notificationGeneration?: string;
};

export type VoiceV2AfterHoursRuntimeState = {
  urgency?: VoiceV2UrgencyState;
  transfer?: VoiceV2TransferSessionState;
  callback?: VoiceV2CallbackState;
  callerClassification?: VoiceV2CallerClassification;
  pendingHandlingAction?: VoiceV2HandlingAction;
  attemptedFallbacks?: VoiceV2FallbackAction[];
};
