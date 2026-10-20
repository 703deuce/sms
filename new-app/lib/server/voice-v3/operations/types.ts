export type VoiceV3OperationType =
  | "SEMANTIC_EXTRACTION"
  | "FIND_AVAILABILITY"
  | "LOOKUP_APPOINTMENT"
  | "REVALIDATE_SLOT"
  | "BOOK_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "TRANSFER"
  | "CREATE_CALLBACK";

export type VoiceV3OperationStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "OUTCOME_UNKNOWN"
  | "CANCELLED"
  | "STALE";

export interface VoiceV3Operation {
  operationId: string;
  type: VoiceV3OperationType;
  status: VoiceV3OperationStatus;
  goalId?: string;
  stateVersionAtStart: number;
  schedulingGeneration?: number;
  attempt: number;
  startedAt?: string;
  finishedAt?: string;
  failureCode?: string;
  providerAttemptId?: string;
}

export type VoiceV3OperationsMap = Record<string, VoiceV3Operation>;
