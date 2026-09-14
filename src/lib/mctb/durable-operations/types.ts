export const MCTB_DURABLE_OPERATION_STATUSES = [
  "PENDING",
  "CLAIMED",
  "PROCESSING",
  "WAITING_PROVIDER",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "FAILED_TERMINAL",
  "CANCELLED",
  "EXPIRED",
] as const;

export type MctbDurableOperationStatus = (typeof MCTB_DURABLE_OPERATION_STATUSES)[number];

export const MCTB_DURABLE_OPERATION_TYPES = [
  "VOICE_AI_BOOKING_TURN",
  "VOICE_AVAILABILITY_CHECK",
  "VOICE_BOOKING_CREATE",
  "MCTB_CUSTOMER_SMS_SEND",
] as const;

export type MctbDurableOperationType = (typeof MCTB_DURABLE_OPERATION_TYPES)[number];

export type MctbDurableFailureClass =
  | "ATTEMPT_TIMED_OUT"
  | "TRANSIENT_PROVIDER"
  | "TRANSIENT_MODEL"
  | "TRANSIENT_NETWORK"
  | "STALE_ACTION"
  | "POLICY_DENIED"
  | "INVALID_INPUT"
  | "PROVIDER_TERMINAL"
  | "WORKER_INTERRUPTED"
  | "UNKNOWN";

export type MctbDurableOperationTraceEvent = {
  at: string;
  step: string;
  detail?: Record<string, unknown>;
};

export type MctbDurableOperationRecord = {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  voiceCallId: string | null;
  operationType: MctbDurableOperationType | string;
  stateVersion: number | null;
  idempotencyKey: string;
  status: MctbDurableOperationStatus;
  attemptCount: number;
  claimedAt: string | null;
  claimLeaseExpiresAt: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  completedAt: string | null;
  inputJson: Record<string, unknown>;
  resultJson: Record<string, unknown> | null;
  failureClass: MctbDurableFailureClass | string | null;
  failureDetail: string | null;
  traceJson: MctbDurableOperationTraceEvent[];
  createdAt: string;
  updatedAt: string;
};

export type VoiceOperationVoiceResult = {
  ok: boolean;
  speak: string;
  status: MctbDurableOperationStatus;
  operationId: string;
  data?: Record<string, unknown>;
  error?: string;
};
