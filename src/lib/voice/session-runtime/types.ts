import type { WorkflowState } from "@/lib/voice/workflow-engine/types";

/** Rich slot reference — preserves resource metadata beyond ISO time. */
export type SlotRef = {
  slotId: string;
  start: string;
  end?: string;
  resourceId?: string | null;
  resourceName?: string | null;
  spokenLabel?: string;
  zone?: string | null;
};

/** Canonical held reservation — single source of truth for slot holds. */
export type HeldReservation = {
  holdId: string;
  workflowId?: string | null;
  resourceId?: string | null;
  resourceName?: string | null;
  serviceName: string;
  start: string;
  end?: string | null;
  expiresAt?: string | null;
  provider?: string | null;
  providerHoldId?: string | null;
  status: "held" | "expired" | "released" | "converted";
  idempotencyKey: string;
};

export type TransferPhase =
  | "idle"
  | "requested"
  | "dialing"
  | "answered"
  | "handoff_complete"
  | "no_answer"
  | "busy"
  | "failed"
  | "returned_to_agent";

export type TransferState = {
  phase: TransferPhase;
  destination?: string | null;
  destinationLabel?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failureReason?: string | null;
  fallbackAction?: string | null;
};

export type ClassificationMap = Record<string, string>;

export type EligibilityResult = {
  status: "in_area" | "out_of_area" | "special_zone" | "unknown";
  zone?: string | null;
  message?: string | null;
  eligibleResourceIds?: string[];
};

export type SessionRuntimeExtensions = {
  /** Rich proposed slots with resource metadata */
  proposedSlotRefs?: SlotRef[];
  /** Canonical hold — replaces bare held_slot ISO when set */
  heldReservation?: HeldReservation | null;
  /** Caller/triage classifications from rules engine */
  classifications?: ClassificationMap;
  /** Service-area / eligibility outcome */
  eligibility?: EligibilityResult | null;
  /** Resolved service id from tenant config */
  resolvedServiceId?: string | null;
  /** Eligible resource ids after filtering */
  eligibleResourceIds?: string[];
  /** Active generic workflow task label */
  currentTask?: string | null;
  /** Transfer state machine */
  transfer?: TransferState;
  /** Customer lookup candidates */
  customerCandidates?: Array<{
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    source: string;
  }>;
  /** Fields that invalidate scheduling when changed */
  schedulingInvalidationFields?: string[];
};

export type OperationTraceEvent = {
  at: string;
  kind: string;
  task?: string | null;
  operationId?: string | null;
  durationMs?: number;
  outcome?: string | null;
  detail?: Record<string, unknown>;
};

/** Standard structured tool result for LLM + logs. */
export type StructuredToolResult = {
  ok: boolean;
  code?: string;
  retryable?: boolean;
  userSafeMessage: string;
  nextAllowedActions?: string[];
  workflowState?: WorkflowState;
  data?: Record<string, unknown>;
};
