import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { searchCrmContactsForVoice } from "@/lib/voice/tools/crm-contact-search";
import { getOrCreateRealtimeSession } from "@/lib/voice/realtime-session/init";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import type {
  TurnToolEnvelope,
  WorkflowRuntimeSnapshot,
} from "@/lib/voice/workflow-runtime/schema";
import type { CanonicalWorkflowState } from "@/lib/voice/workflow-runtime/canonical-state";
import type { ToolCallRecord } from "@/lib/voice/workflow-runtime/loop-detection";
import {
  applyVoiceWorkflowStore,
  resolveActiveWorkflowForAgent,
  setActiveWorkflowForAgent,
} from "@/lib/voice/workflow-runtime/loader";
import {
  getPinnedWorkflowFromCall,
  loadDefinitionFromStore,
  loadVoiceWorkflowStoreForAgent,
  pinWorkflowOnCall,
} from "@/lib/voice/workflow-runtime/persistence";
import { hydrateWorkflowDefinition } from "@/lib/voice/workflow-runtime/hydrate";
import type { ActiveWorkflowRef } from "@/lib/voice/workflow-runtime/loader";
import { buildHeldSlotPayload, buildRequirementsPayload } from "./tool-results";

export type LiveKitAgentSyncSnapshot = {
  workflowState: WorkflowState;
  taskId: string;
  toolNames: string[];
  envelope?: TurnToolEnvelope;
};

export type LiveKitCallContext = {
  callId: string;
  workspaceId: string;
  agentId: string;
  session: AmyRealtimeSession;
  businessName: string;
  contactId: string | null;
  workflowState: WorkflowState;
  workflowRef?: ActiveWorkflowRef;
  workflowDefinition?: import("@/lib/voice/workflow-runtime/schema").WorkflowDefinition;
  workflowRuntime?: WorkflowRuntimeSnapshot;
  lastToolEnvelope?: TurnToolEnvelope;
  canonicalWorkflow?: CanonicalWorkflowState;
  toolCallHistory?: ToolCallRecord[];
  lastAgentSync?: LiveKitAgentSyncSnapshot;
  agentSyncGeneration?: number;
};

export async function bootstrapLiveKitCallContext(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  fromE164?: string | null;
  toE164?: string | null;
}): Promise<LiveKitCallContext> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { name: true },
  });

  const session = await getOrCreateRealtimeSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: "book_appointment",
  });

  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { metadata: true },
  });
  const pinned = getPinnedWorkflowFromCall(call?.metadata);

  const store = await loadVoiceWorkflowStoreForAgent({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });
  applyVoiceWorkflowStore(store);

  const activeRef =
    pinned ||
    store.activeByAgent[input.agentId] ||
    resolveActiveWorkflowForAgent(input.agentId).ref;

  let definition =
    loadDefinitionFromStore(store, activeRef) ||
    resolveActiveWorkflowForAgent(input.agentId).definition;

  definition = hydrateWorkflowDefinition(definition, session.fieldManifest);
  setActiveWorkflowForAgent(input.agentId, activeRef);

  const entryNodeId = definition.entryNodeId;
  const runtimeNodeId =
    session.currentNodeId ||
    session.runtime.current_node_id ||
    entryNodeId;

  session.voiceWorkflowId = activeRef.workflowId;
  session.voiceWorkflowVersion = activeRef.version;
  session.currentNodeId = runtimeNodeId;
  session.runtime = {
    ...session.runtime,
    voice_workflow_id: activeRef.workflowId,
    voice_workflow_version: activeRef.version,
    current_node_id: runtimeNodeId,
  };

  if (!pinned) {
    await pinWorkflowOnCall({
      callId: input.callId,
      ref: activeRef,
      entryNodeId: runtimeNodeId,
    });
  }

  let contactId = session.contactId;
  const ani = input.fromE164?.trim();
  if (ani && ani !== "unknown") {
    const normalized = normalizeE164(ani);
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: normalized } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (contact) {
      contactId = contact.id;
      await prisma.voiceCall.update({
        where: { id: input.callId },
        data: { contactId: contact.id, fromE164: normalized },
      });
    } else {
      const crm = await searchCrmContactsForVoice({
        workspaceId: input.workspaceId,
        phone: normalized,
        query: "",
        matchType: "phone",
        limit: 1,
      }).catch(() => null);
      if (crm?.matches?.[0]?.safeId) {
        contactId = crm.matches[0].safeId;
      }
    }
  }

  return {
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    session,
    businessName: ws?.name || agent?.name || "the business",
    contactId,
    workflowState: session.currentState,
    workflowRef: activeRef,
    workflowDefinition: definition,
  };
}

export async function finalizeLiveKitCall(callId: string): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { workspaceId: true, startedAt: true, endedAt: true },
  });
  if (!call) return;

  const endedAt = call.endedAt || new Date();
  const durationSeconds =
    call.startedAt != null
      ? Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000))
      : undefined;

  const { finalizeLiveKitTranscript, enqueueLiveKitPostCallJob } = await import(
    "@/lib/voice/runtime-provider/livekit-call-telemetry"
  );
  await finalizeLiveKitTranscript(callId).catch(() => undefined);

  await prisma.voiceCall
    .updateMany({
      where: { id: callId },
      data: {
        endedAt,
        status: "COMPLETED",
        ...(durationSeconds != null ? { durationSeconds } : {}),
      },
    })
    .catch(() => undefined);

  await enqueueLiveKitPostCallJob({
    workspaceId: call.workspaceId,
    callId,
  });
}

function activeFieldPayload(session: AmyRealtimeSession): Record<string, unknown> | null {
  const payload = buildRequirementsPayload(session);
  return (payload.activeField as Record<string, unknown> | null) || null;
}

function missingFieldIds(session: AmyRealtimeSession): string[] {
  return session.fieldManifest
    .filter((field) => field.required && !session.collectedFields[field.field_id]?.trim())
    .map((field) => field.field_id);
}

export function taskContextPayload(ctx: LiveKitCallContext): Record<string, unknown> {
  const s = ctx.session;
  const missing = missingFieldIds(s);
  return {
    workflow_state: s.currentState,
    active_field: s.activeField,
    activeField: activeFieldPayload(s),
    missing_fields: missing.length ? missing : s.missingFieldIds,
    collected_fields: s.collectedFields,
    ready_for_availability: missing.length === 0,
    service_name: s.serviceName,
    available_slots: s.availableSlots,
    held_slot: s.heldSlot,
    heldSlot: buildHeldSlotPayload(s),
    selected_slot: s.selectedSlot,
    contact_id: ctx.contactId,
    caller_ani: s.callerAni,
  };
}
