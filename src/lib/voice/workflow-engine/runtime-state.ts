import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import type {
  AgentRuntimeRecord,
  FieldReceipt,
  OperationReceipt,
  StateTransition,
  WorkflowState,
} from "./types";

const RUNTIME_META_KEY = "agentRuntime";
export const WORKFLOW_VERSION = "v1";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function emptyAgentRuntime(input: {
  workflowId?: WorkflowAction;
  serviceName?: string | null;
}): AgentRuntimeRecord {
  const now = new Date().toISOString();
  return {
    workflow_id: input.workflowId || "book_appointment",
    workflow_version: WORKFLOW_VERSION,
    state: "INTENT_DISCOVERY",
    intent: input.workflowId || null,
    service_name: input.serviceName ?? null,
    field_receipts: [],
    operation_receipts: [],
    proposed_slots: [],
    held_slot: null,
    selected_slot: null,
    booking_id: null,
    pending_operations: [],
    state_history: [{ from: "INTENT_DISCOVERY", to: "INTENT_DISCOVERY", at: now, reason: "session_start" }],
    updated_at: now,
  };
}

export async function loadAgentRuntime(callId: string): Promise<AgentRuntimeRecord | null> {
  const call = await getPrisma().voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  const raw = asRecord(meta[RUNTIME_META_KEY]);
  if (!raw.workflow_id) return null;
  return parseAgentRuntime(raw);
}

function parseAgentRuntime(raw: Record<string, unknown>): AgentRuntimeRecord {
  return {
    workflow_id: (raw.workflow_id as WorkflowAction) || "book_appointment",
    workflow_version: String(raw.workflow_version || WORKFLOW_VERSION),
    state: (raw.state as WorkflowState) || "INTENT_DISCOVERY",
    intent: (raw.intent as WorkflowAction) || null,
    service_name: raw.service_name ? String(raw.service_name) : null,
    field_receipts: Array.isArray(raw.field_receipts)
      ? (raw.field_receipts as FieldReceipt[])
      : [],
    operation_receipts: Array.isArray(raw.operation_receipts)
      ? (raw.operation_receipts as OperationReceipt[])
      : [],
    proposed_slots: Array.isArray(raw.proposed_slots)
      ? raw.proposed_slots.map(String)
      : [],
    held_slot: raw.held_slot ? String(raw.held_slot) : null,
    selected_slot: raw.selected_slot ? String(raw.selected_slot) : null,
    booking_id: raw.booking_id ? String(raw.booking_id) : null,
    voice_workflow_id: raw.voice_workflow_id ? String(raw.voice_workflow_id) : null,
    voice_workflow_version:
      raw.voice_workflow_version != null ? Number(raw.voice_workflow_version) : null,
    current_node_id: raw.current_node_id ? String(raw.current_node_id) : null,
    confirmation_received: Boolean(raw.confirmation_received),
    pending_operations: Array.isArray(raw.pending_operations)
      ? raw.pending_operations.map(String)
      : [],
    state_history: Array.isArray(raw.state_history)
      ? (raw.state_history as StateTransition[])
      : [],
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

export async function saveAgentRuntime(
  callId: string,
  runtime: AgentRuntimeRecord,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) throw new Error("Call not found");
  const meta = asRecord(call.metadata);
  const next = { ...runtime, updated_at: new Date().toISOString() };
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        [RUNTIME_META_KEY]: next,
      },
    },
  });
}

export async function ensureAgentRuntime(input: {
  callId: string;
  workflowId?: WorkflowAction;
  serviceName?: string | null;
}): Promise<AgentRuntimeRecord> {
  const existing = await loadAgentRuntime(input.callId);
  if (existing) return existing;
  const runtime = emptyAgentRuntime({
    workflowId: input.workflowId,
    serviceName: input.serviceName,
  });
  await saveAgentRuntime(input.callId, runtime);
  return runtime;
}

export function hashFieldValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function appendFieldReceipt(
  runtime: AgentRuntimeRecord,
  fieldId: string,
  value: string,
): AgentRuntimeRecord {
  const receipt: FieldReceipt = {
    receipt_id: `frc_${fieldId}_${Date.now()}`,
    field_id: fieldId,
    value_hash: hashFieldValue(value),
    saved_at: new Date().toISOString(),
  };
  const withoutDup = runtime.field_receipts.filter((r) => r.field_id !== fieldId);
  return {
    ...runtime,
    field_receipts: [...withoutDup, receipt],
    updated_at: new Date().toISOString(),
  };
}

export function appendOperationReceipt(
  runtime: AgentRuntimeRecord,
  receipt: OperationReceipt,
): AgentRuntimeRecord {
  const withoutDup = runtime.operation_receipts.filter(
    (r) => r.operation_id !== receipt.operation_id,
  );
  return {
    ...runtime,
    operation_receipts: [...withoutDup, receipt],
    updated_at: new Date().toISOString(),
  };
}

export function transitionState(
  runtime: AgentRuntimeRecord,
  to: WorkflowState,
  reason: string,
): AgentRuntimeRecord {
  if (runtime.state === to) return runtime;
  const transition: StateTransition = {
    from: runtime.state,
    to,
    at: new Date().toISOString(),
    reason,
  };
  return {
    ...runtime,
    state: to,
    state_history: [...runtime.state_history.slice(-49), transition],
    updated_at: new Date().toISOString(),
  };
}
