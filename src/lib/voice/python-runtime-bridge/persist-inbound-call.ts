import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { realEstateCallConfigStamp } from "@/lib/voice/real-estate/publish";

import { mediaBackendMetadataStamp } from "@/lib/voice/media-backend/pinning";
import type { MediaBackend } from "@/lib/voice/media-backend/types";

export type PersistInboundCallInput = {
  callId: string;
  workspaceId: string;
  agentId: string;
  agentVersionId?: string;
  fromE164?: string;
  toE164?: string;
  livekitRoomName?: string;
  livekitParticipantId?: string;
  mediaBackend?: MediaBackend;
};

export async function persistInboundCallForPython(
  input: PersistInboundCallInput,
): Promise<{ ok: true; callId: string } | { ok: false; error: string; code?: string }> {
  const callId = input.callId.trim();
  if (!callId) {
    return { ok: false, error: "callId is required", code: "MISSING_CALL_ID" };
  }

  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, callId };
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      phoneNumberId: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });
  if (!agent) {
    return { ok: false, error: "Agent not found", code: "AGENT_NOT_FOUND" };
  }

  const runtimeCfg = agent.publishedVersionId
    ? await (async () => {
        const ver = await prisma.voiceAgentVersion.findFirst({
          where: { id: agent.publishedVersionId!, workspaceId: input.workspaceId },
          select: { config: true },
        });
        return parseVoiceAgentConfig(ver?.config || agent.draftConfig);
      })()
    : parseVoiceAgentConfig(agent.draftConfig);
  const configStamp = realEstateCallConfigStamp(runtimeCfg);

  let toE164 = input.toE164?.trim() || "";
  if (!toE164 && agent.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId },
      select: { e164: true },
    });
    toE164 = pn?.e164 || "";
  }

  const fromRaw = input.fromE164?.trim() || "unknown";
  const fromE164 =
    fromRaw && fromRaw !== "unknown"
      ? normalizeE164(fromRaw)
      : fromRaw;

  await prisma.voiceCall.create({
    data: {
      id: callId,
      workspaceId: input.workspaceId,
      agentId: agent.id,
      agentVersionId: input.agentVersionId || agent.publishedVersionId,
      phoneNumberId: agent.phoneNumberId,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164,
      toE164: toE164 || "unknown",
      startedAt: new Date(),
      answeredAt: new Date(),
      metadata: {
        source: "livekit_voice_runtime",
        voiceV3WizardBound: true,
        voiceTransport: "voice_v3_livekit",
        bootstrapPath: "async_persist",
        ...(input.mediaBackend ? mediaBackendMetadataStamp(input.mediaBackend) : {}),
        ...(input.livekitRoomName ? { livekitRoomName: input.livekitRoomName } : {}),
        ...(input.livekitParticipantId
          ? { livekitParticipantId: input.livekitParticipantId }
          : {}),
        realtorAgentConfig: configStamp,
      } as object,
    },
  });

  if (input.livekitRoomName) {
    const { maybeStartVoiceV3LiveKitRecording } = await import(
      "@/lib/voice-v3/post-call/recording"
    );
    await maybeStartVoiceV3LiveKitRecording({
      workspaceId: input.workspaceId,
      callId,
      roomName: input.livekitRoomName,
    }).catch(() => undefined);
  }

  return { ok: true, callId };
}
