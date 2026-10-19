import { getPrisma } from "@/lib/server/db";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { putLiveSession } from "@/lib/server/receptionist/runtime/session-store";

export type LiveKitBootstrapPayload = {
  roomName: string;
  sipParticipantIdentity: string;
  callerE164?: string | null;
  dialedE164?: string | null;
  sipCallId?: string | null;
  providerCallId?: string | null;
  trunkId?: string | null;
  ruleId?: string | null;
  telnyxCallScreeningRaw?: string | null;
};

function liveSessionIdForRoom(roomName: string): string {
  const room = roomName.trim();
  return room.startsWith("lk_") ? room : `lk_${room}`;
}

async function ensureVoiceCallRow(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  caller: string | null;
  dialed: string;
  roomName: string;
  sipParticipantIdentity: string;
}) {
  const prisma = getPrisma();
  await prisma.voiceCall
    .create({
      data: {
        id: input.callId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        direction: "INBOUND",
        status: "IN_PROGRESS",
        fromE164: input.caller || "unknown",
        toE164: input.dialed,
        phoneNumberId: input.phoneNumberId,
        metadata: {
          liveSessionId: input.callId,
          roomName: input.roomName,
          sipParticipantIdentity: input.sipParticipantIdentity,
        },
      },
    })
    .catch(() => undefined);
}

/** Prefer certified monolith Voice V3 session resolver; local fallback for degraded dev. */
export async function resolveVoiceV3LiveKitSessionForNewApp(payload: LiveKitBootstrapPayload) {
  try {
    const { resolveVoiceV3LiveKitSessionMonolith } = await import(
      "@/lib/server/receptionist/runtime/voice-v3-bridge"
    );
    const result = await resolveVoiceV3LiveKitSessionMonolith(payload);
    const bundle: ReceptionistPublishedBundle | null = null;
    putLiveSession({
      liveSessionId: result.liveSessionId,
      callId: result.callId,
      workspaceId: result.workspaceId,
      agentId: result.agentId,
      phoneNumberId: result.phoneNumberId,
      bundle: bundle || {
        schemaVersion: 1,
        publishedAt: new Date().toISOString(),
        editor: {} as never,
        runtime: {
          amyInstructions: result.amyInstructions,
          astraInstructions: result.astraInstructions,
          liveVoiceId: result.liveVoiceId,
          astraModel: result.astraModel,
          toolNames: result.toolNames,
          maxToolSteps: result.maxToolSteps,
          openaiFileSearchVectorStoreIds: result.openaiFileSearchVectorStoreIds,
          voiceV3: {},
        },
      },
      intake: {},
    });
    return result;
  } catch (monolithErr) {
    console.warn("VOICE_V3_MONOLITH_SESSION_FALLBACK", {
      message: monolithErr instanceof Error ? monolithErr.message : String(monolithErr),
    });
  }

  const { resolveReceptionistByCalledNumber } = await import(
    "@/lib/server/receptionist/routing-resolve"
  );
  const { loadPublishedBundleForAgent } = await import("@/lib/server/receptionist/agent-service");

  const dialed = payload.dialedE164?.trim();
  if (!dialed) throw new Error("dialedE164 is required");

  const routing = await resolveReceptionistByCalledNumber(dialed);
  if (!routing || routing.paused) throw new Error(`No active receptionist for ${dialed}`);

  const bundle = await loadPublishedBundleForAgent(routing.agentId, routing.workspaceId);
  if (!bundle?.runtime) throw new Error("Published receptionist configuration missing");

  const liveSessionId = liveSessionIdForRoom(payload.roomName);
  const callId = liveSessionId;
  const rt = bundle.runtime;

  putLiveSession({
    liveSessionId,
    callId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    phoneNumberId: routing.phoneNumberId,
    bundle,
    intake: {},
  });

  await ensureVoiceCallRow({
    callId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    phoneNumberId: routing.phoneNumberId,
    caller: payload.callerE164?.trim() || null,
    dialed,
    roomName: payload.roomName,
    sipParticipantIdentity: payload.sipParticipantIdentity,
  });

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
