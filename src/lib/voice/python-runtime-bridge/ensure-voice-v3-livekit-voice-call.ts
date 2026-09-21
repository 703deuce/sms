import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function ensureVoiceV3LiveKitVoiceCall(input: {
  callId: string;
  liveSessionId: string;
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  fromE164?: string | null;
  toE164?: string | null;
  roomName?: string | null;
  sipParticipantIdentity?: string | null;
  liveKitJobId?: string | null;
}): Promise<{ ok: true; callId: string }> {
  const callId = input.callId.trim();
  const workspaceId = input.workspaceId.trim();
  if (!callId || !workspaceId) {
    throw new Error("callId and workspaceId are required");
  }

  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    select: { id: true, metadata: true },
  });

  const fromRaw = input.fromE164?.trim() || "unknown";
  const fromE164 =
    fromRaw && fromRaw !== "unknown" ? normalizeE164(fromRaw) : fromRaw;
  const toE164 = input.toE164?.trim() || "unknown";

  const voiceV3Stamp = {
    callId,
    liveSessionId: input.liveSessionId.trim(),
    transport: "voice_v3_livekit_gpt_live",
    roomName: input.roomName?.trim() || null,
    sipParticipantIdentity: input.sipParticipantIdentity?.trim() || null,
    liveKitJobId: input.liveKitJobId?.trim() || null,
  };

  if (existing) {
    const meta = (existing.metadata || {}) as Record<string, unknown>;
    await prisma.voiceCall.update({
      where: { id: existing.id },
      data: {
        metadata: {
          ...meta,
          voiceV3: { ...((meta.voiceV3 as object) || {}), ...voiceV3Stamp },
        } as Prisma.InputJsonValue,
      },
    });
    return { ok: true, callId: existing.id };
  }

  await prisma.voiceCall.create({
    data: {
      id: callId,
      workspaceId,
      agentId: input.agentId,
      phoneNumberId: input.phoneNumberId || null,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164,
      toE164,
      startedAt: new Date(),
      answeredAt: new Date(),
      metadata: {
        source: "voice_v3_livekit",
        bootstrapPath: "resolve_voice_v3_livekit_session",
        voiceV3: voiceV3Stamp,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, callId };
}
