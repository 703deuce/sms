import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { searchCrmContactsForVoice } from "@/lib/voice/tools/crm-contact-search";
import { getOrCreateRealtimeSession } from "@/lib/voice/realtime-session/init";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import { buildHeldSlotPayload, buildRequirementsPayload } from "./tool-results";

export type LiveKitAgentSyncSnapshot = {
  workflowState: WorkflowState;
  taskId: string;
  toolNames: string[];
};

export type LiveKitCallContext = {
  callId: string;
  workspaceId: string;
  agentId: string;
  session: AmyRealtimeSession;
  businessName: string;
  contactId: string | null;
  workflowState: WorkflowState;
  lastAgentSync?: LiveKitAgentSyncSnapshot;
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
  };
}

export async function finalizeLiveKitCall(callId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.voiceCall
    .updateMany({
      where: { id: callId, endedAt: null },
      data: { endedAt: new Date(), status: "COMPLETED" },
    })
    .catch(() => undefined);
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
