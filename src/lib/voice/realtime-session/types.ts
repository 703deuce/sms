import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import type { AgentRuntimeRecord, WorkflowState } from "@/lib/voice/workflow-engine/types";
import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";

/** Short-lived per-call realtime state — authoritative for hot-path reads. */
export type AmyRealtimeSession = {
  sessionId: string;
  callId: string;
  telnyxConversationId: string | null;
  telnyxControlId: string | null;
  agentId: string;
  workspaceId: string;
  workflowId: WorkflowAction;
  currentState: WorkflowState;
  collectedFields: Record<string, string>;
  activeField: string | null;
  missingFieldIds: string[];
  lastIntent: string | null;
  lastUserUtterance: string | null;
  pendingOperation: {
    id: string;
    type: string;
    startedAt: string;
  } | null;
  lastRuntimeResult: Record<string, unknown> | null;
  availableSlots: string[];
  heldSlot: string | null;
  selectedSlot: string | null;
  confirmationState: "none" | "awaiting" | "confirmed";
  contactId: string | null;
  callerAni: string | null;
  serviceName: string | null;
  bookingId: string | null;
  /** Declarative workflow-runtime position (authoritative over legacy state mapping) */
  voiceWorkflowId: string | null;
  voiceWorkflowVersion: number | null;
  currentNodeId: string | null;
  /** Mirrors voiceCall.metadata.agentRuntime for fast access */
  runtime: AgentRuntimeRecord;
  /** Cached field manifest entries (static per agent version) */
  fieldManifest: RuntimeFieldManifestEntry[];
  timezone: string;
  version: number;
  configHash: string;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeTurnRequest = {
  workspaceId: string;
  agentId?: string;
  callId: string;
  utterance?: string | null;
  interpreted_intent?: string | null;
  extracted_information?: Record<string, unknown>;
  confirm?: boolean;
  workflow?: WorkflowAction;
  serviceName?: string | null;
};

export type RuntimeTurnResponse = Record<string, unknown> & {
  ok?: boolean;
  mode?: "speak" | "end_call";
  speak?: string;
  workflow_state?: WorkflowState;
  operation?: {
    status: "pending" | "completed" | "failed";
    id?: string;
    type?: string;
  };
  _latency?: TurnLatencySnapshot;
};

export type TurnLatencySnapshot = {
  callId: string;
  conversationId?: string | null;
  sessionId: string;
  state_before: WorkflowState;
  intent?: string;
  decision: string;
  operation_started?: boolean;
  operation_id?: string;
  operation_duration_ms?: number;
  state_after: WorkflowState;
  session_load_ms: number;
  routing_ms: number;
  db_duration_ms: number;
  external_duration_ms: number;
  response_duration_ms: number;
  total_duration_ms: number;
};

export type StaticSessionConfig = {
  configHash: string;
  agentId: string;
  workspaceId: string;
  timezone: string;
  fieldManifest: RuntimeFieldManifestEntry[];
  defaultServiceName: string;
  publishedVersionId: string | null;
};

export type SessionPatch = Partial<
  Pick<
    AmyRealtimeSession,
    | "currentState"
    | "collectedFields"
    | "activeField"
    | "missingFieldIds"
    | "lastIntent"
    | "lastUserUtterance"
    | "pendingOperation"
    | "lastRuntimeResult"
    | "availableSlots"
    | "heldSlot"
    | "selectedSlot"
    | "confirmationState"
    | "contactId"
    | "callerAni"
    | "serviceName"
    | "bookingId"
    | "voiceWorkflowId"
    | "voiceWorkflowVersion"
    | "currentNodeId"
    | "runtime"
    | "telnyxConversationId"
    | "telnyxControlId"
  >
>;
