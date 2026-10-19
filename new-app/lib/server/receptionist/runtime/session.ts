import { getPrisma } from "@/lib/server/db";
import { loadPublishedBundleForAgent } from "@/lib/server/receptionist/agent-service";
import { resolveReceptionistByCalledNumber } from "@/lib/server/receptionist/routing-resolve";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { putLiveSession } from "@/lib/server/receptionist/runtime/session-store";

export type LiveKitBootstrapPayload = {
  roomName: string;
  sipParticipantIdentity: string;
  callerE164?: string | null;
  dialedE164?: string | null;
  sipCallId?: string | null;
  providerCallId?: string | null;
};

function liveSessionIdForRoom(roomName: string): string {
  const room = roomName.trim();
  return room.startsWith("lk_") ? room : `lk_${room}`;
}

export async function resolveVoiceV3LiveKitSessionForNewApp(payload: LiveKitBootstrapPayload) {
  const dialed = payload.dialedE164?.trim();
  if (!dialed) throw new Error("dialedE164 is required");

  const routing = await resolveReceptionistByCalledNumber(dialed);
  if (!routing || routing.paused) {
    throw new Error(`No active receptionist for ${dialed}`);
  }

  const bundle = await loadPublishedBundleForAgent(routing.agentId, routing.workspaceId);
  if (!bundle?.runtime) {
    throw new Error("Published receptionist configuration missing");
  }

  const liveSessionId = liveSessionIdForRoom(payload.roomName);
  const callId = liveSessionId;

  putLiveSession({
    liveSessionId,
    callId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    phoneNumberId: routing.phoneNumberId,
    bundle,
    intake: {},
  });

  const prisma = getPrisma();
  await prisma.voiceCall
    .create({
      data: {
        id: callId,
        workspaceId: routing.workspaceId,
        agentId: routing.agentId,
        direction: "INBOUND",
        status: "IN_PROGRESS",
        fromE164: payload.callerE164?.trim() || "unknown",
        toE164: dialed,
        phoneNumberId: routing.phoneNumberId,
        metadata: {
          liveSessionId,
          roomName: payload.roomName,
          sipParticipantIdentity: payload.sipParticipantIdentity,
        },
      },
    })
    .catch(() => {
      /* idempotent if call already exists */
    });

  const rt = bundle.runtime;
  return {
    liveSessionId,
    callId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    phoneNumberId: routing.phoneNumberId,
    amyInstructions: rt.amyInstructions,
    astraInstructions: rt.astraInstructions,
    astraModel: rt.astraModel,
    liveVoiceId: rt.liveVoiceId,
    toolSchemas: rt.toolNames.map((name) => ({
      type: "function",
      name,
      description: name,
      parameters: { type: "object", properties: {} },
    })),
    toolNames: rt.toolNames,
    intakeFields: [],
    parallelToolCalls: false,
    maxToolSteps: rt.maxToolSteps,
    reasoningEffort: "low",
    textVerbosity: "low",
    openaiFileSearchVectorStoreIds: rt.openaiFileSearchVectorStoreIds,
  };
}
