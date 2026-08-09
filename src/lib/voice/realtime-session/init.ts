import { getPrisma } from "@/lib/db";
import {
  ensureAgentRuntime,
  loadAgentRuntime,
  saveAgentRuntime,
} from "@/lib/voice/workflow-engine/runtime-state";
import {
  ensureWorkflowFieldSession,
  loadWorkflowFieldSession,
} from "@/lib/voice/field-runtime/session";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import { loadStaticSessionConfig } from "./static-config";
import { getRealtimeSessionStore } from "./store";
import type { AmyRealtimeSession } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSlotIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const str = String(value ?? "").trim();
  if (!str) return "";
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : d.toISOString();
}

function deriveStateFromSession(session: AmyRealtimeSession): WorkflowState {
  const runtime = session.runtime;
  if (runtime.pending_operations.length > 0) return "BOOKING_IN_PROGRESS";
  if (session.bookingId || runtime.booking_id) return "COMPLETE";

  const workflow = session.workflowId;
  if (workflow === "general" || workflow === "leave_message" || workflow === "request_quote") {
    return "GENERAL";
  }

  if (session.missingFieldIds.length > 0) {
    return runtime.intent ? "COLLECTING_FIELDS" : "INTENT_DISCOVERY";
  }
  if (!session.availableSlots.length && !runtime.proposed_slots.length) {
    return "CHECKING_AVAILABILITY";
  }
  if (!session.selectedSlot && !session.heldSlot && !runtime.selected_slot && !runtime.held_slot) {
    return "SELECTING_SLOT";
  }
  return "READY_TO_BOOK";
}

function buildCollectedFields(
  session: Awaited<ReturnType<typeof ensureWorkflowFieldSession>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [fieldId, entry] of Object.entries(session.fields)) {
    if (entry?.value != null) out[fieldId] = String(entry.value);
  }
  return out;
}

function computeMissingFieldIds(
  manifest: AmyRealtimeSession["fieldManifest"],
  collected: Record<string, string>,
): string[] {
  return manifest
    .filter((f) => f.required && !collected[f.field_id]?.trim())
    .map((f) => f.field_id);
}

export async function hydrateRealtimeSession(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
  telnyxConversationId?: string | null;
  telnyxControlId?: string | null;
  callerAni?: string | null;
}): Promise<AmyRealtimeSession> {
  const workflow = input.workflow || "book_appointment";
  const staticConfig = await loadStaticSessionConfig({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  let runtime = await loadAgentRuntime(input.callId);
  if (!runtime) {
    runtime = await ensureAgentRuntime({
      callId: input.callId,
      workflowId: workflow,
      serviceName: input.serviceName,
    });
  }

  const fieldSession = await ensureWorkflowFieldSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: {
      telnyxConversationId: true,
      telnyxCallControlId: true,
      fromE164: true,
      contactId: true,
      metadata: true,
    },
  });

  const meta = asRecord(call?.metadata);
  const metaSlots = Array.isArray(meta.lastAvailabilitySlots)
    ? (meta.lastAvailabilitySlots as unknown[]).map(normalizeSlotIso).filter(Boolean)
    : [];
  const availableSlots =
    metaSlots.length > 0
      ? metaSlots
      : runtime.proposed_slots.map(normalizeSlotIso).filter(Boolean);

  const collectedFields = buildCollectedFields(fieldSession);
  const missingFieldIds = computeMissingFieldIds(staticConfig.fieldManifest, collectedFields);
  const activeField =
    fieldSession.active_field && missingFieldIds.includes(fieldSession.active_field)
      ? fieldSession.active_field
      : missingFieldIds[0] || null;

  const now = new Date().toISOString();
  const session: AmyRealtimeSession = {
    sessionId: input.callId,
    callId: input.callId,
    telnyxConversationId:
      input.telnyxConversationId ?? call?.telnyxConversationId ?? null,
    telnyxControlId: input.telnyxControlId ?? call?.telnyxCallControlId ?? null,
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    workflowId: workflow,
    currentState: "INTENT_DISCOVERY",
    collectedFields,
    activeField,
    missingFieldIds,
    lastIntent: runtime.intent ?? null,
    lastUserUtterance: null,
    pendingOperation: null,
    lastRuntimeResult: null,
    availableSlots,
    heldSlot: runtime.held_slot ?? null,
    selectedSlot: runtime.selected_slot ?? null,
    confirmationState: runtime.confirmation_received || runtime.booking_id
      ? "confirmed"
      : runtime.held_slot
        ? "awaiting"
        : "none",
    contactId: call?.contactId ?? null,
    callerAni: input.callerAni ?? call?.fromE164 ?? null,
    serviceName: input.serviceName ?? runtime.service_name ?? staticConfig.defaultServiceName ?? null,
    bookingId: runtime.booking_id ?? null,
    voiceWorkflowId: runtime.voice_workflow_id ?? null,
    voiceWorkflowVersion: runtime.voice_workflow_version ?? null,
    currentNodeId: runtime.current_node_id ?? null,
    runtime,
    fieldManifest: staticConfig.fieldManifest,
    timezone: staticConfig.timezone,
    version: 1,
    configHash: staticConfig.configHash,
    createdAt: now,
    updatedAt: now,
  };
  session.currentState = deriveStateFromSession(session);
  return session;
}

export async function getOrCreateRealtimeSession(input: {
  callId: string;
  workspaceId: string;
  agentId?: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<AmyRealtimeSession> {
  const store = getRealtimeSessionStore();
  const cached = await store.get(input.callId);
  if (cached) return cached;

  if (!input.agentId) throw new Error("agentId required to create realtime session");

  const session = await hydrateRealtimeSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: input.workflow,
    serviceName: input.serviceName,
  });
  await store.set(input.callId, session);
  return session;
}

export async function syncSessionToDurableStore(session: AmyRealtimeSession): Promise<void> {
  await saveAgentRuntime(session.callId, session.runtime);

  const fieldSession = await loadWorkflowFieldSession(session.callId);
  if (fieldSession) {
    const { saveWorkflowFieldSession } = await import("@/lib/voice/field-runtime/session");
    await saveWorkflowFieldSession(session.callId, {
      ...fieldSession,
      active_field: session.activeField,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function updateSessionAfterRuntimeChange(
  session: AmyRealtimeSession,
  patch: Partial<AmyRealtimeSession>,
): Promise<AmyRealtimeSession> {
  const store = getRealtimeSessionStore();
  const merged = { ...session, ...patch };
  merged.currentState = deriveStateFromSession(merged);
  const updated = await store.patch(session.callId, {
    ...patch,
    currentState: merged.currentState,
    runtime: patch.runtime ?? session.runtime,
  });
  return updated;
}

export async function initializeRealtimeSessionForCall(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  telnyxConversationId?: string | null;
  telnyxControlId?: string | null;
  fromE164?: string | null;
}): Promise<AmyRealtimeSession> {
  const session = await hydrateRealtimeSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    telnyxConversationId: input.telnyxConversationId,
    telnyxControlId: input.telnyxControlId,
    callerAni: input.fromE164,
  });
  await getRealtimeSessionStore().set(input.callId, session);
  return session;
}

export async function destroyRealtimeSession(callId: string): Promise<void> {
  await getRealtimeSessionStore().delete(callId);
}

export async function reloadRealtimeSession(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<AmyRealtimeSession> {
  await getRealtimeSessionStore().delete(input.callId);
  return getOrCreateRealtimeSession(input);
}

export function computeWorkflowStateFromSession(session: AmyRealtimeSession): WorkflowState {
  return deriveStateFromSession(session);
}

export function refreshSessionFieldState(session: AmyRealtimeSession): AmyRealtimeSession {
  const missingFieldIds = computeMissingFieldIds(session.fieldManifest, session.collectedFields);
  const activeField =
    session.activeField && missingFieldIds.includes(session.activeField)
      ? session.activeField
      : missingFieldIds[0] || null;
  const next = {
    ...session,
    missingFieldIds,
    activeField,
  };
  next.currentState = deriveStateFromSession(next);
  return next;
}

export function setSessionFieldFast(
  session: AmyRealtimeSession,
  fieldId: string,
  value: string,
): AmyRealtimeSession {
  const collectedFields = { ...session.collectedFields, [fieldId]: value };
  return refreshSessionFieldState({
    ...session,
    collectedFields,
  });
}
