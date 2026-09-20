import "server-only";

import { EncodedFileOutput, EncodedFileType } from "@livekit/protocol";
import { EgressClient } from "livekit-server-sdk";
import { getPrisma } from "@/lib/db";
import { getActiveMediaBackend } from "@/lib/voice/media-backend/resolver";
import { getLiveKitBackendConfig } from "@/lib/voice/media-backend/config";
import { shouldRecordVoiceV3Call } from "./recording-policy";

function getLiveKitEgressClient(): EgressClient {
  const cfg = getLiveKitBackendConfig(getActiveMediaBackend());
  return new EgressClient(cfg.url, cfg.apiKey, cfg.apiSecret);
}

function egressFileOutputForCall(callId: string): EncodedFileOutput {
  const prefix = process.env.LIVEKIT_EGRESS_FILE_PREFIX?.trim() || "transovo/voice-v3";
  return new EncodedFileOutput({
    fileType: EncodedFileType.OGG,
    filepath: `${prefix}/${callId}-${Date.now()}.ogg`,
  });
}

/** Start LiveKit room audio egress when wizard recording is enabled. Idempotent per call. */
export async function maybeStartVoiceV3LiveKitRecording(input: {
  workspaceId: string;
  callId: string;
  roomName: string;
}): Promise<{ ok: boolean; egressId?: string; skipped?: string }> {
  const enabled = await shouldRecordVoiceV3Call(input.callId);
  if (!enabled) return { ok: true, skipped: "recording_disabled" };
  return startVoiceV3LiveKitRecording(input);
}

/** Start LiveKit room audio egress (non-blocking). Idempotent per call. */
export async function startVoiceV3LiveKitRecording(input: {
  workspaceId: string;
  callId: string;
  roomName: string;
}): Promise<{ ok: boolean; egressId?: string; skipped?: string }> {
  const prisma = getPrisma();
  const existing = await prisma.voiceRecording.findFirst({
    where: { callId: input.callId, workspaceId: input.workspaceId },
    select: { id: true, status: true, providerRecordingId: true },
  });
  if (existing?.providerRecordingId) {
    return { ok: true, skipped: "recording_row_exists", egressId: existing.providerRecordingId };
  }

  const api = getLiveKitEgressClient();
  const egressIdempotency = `voice-v3-egress:${input.callId}`;
  const pending = await prisma.voiceRecording.findFirst({
    where: { callId: input.callId },
  });
  if (!pending) {
    await prisma.voiceRecording.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        provider: "livekit",
        status: "processing",
        channels: 2,
        providerRecordingId: egressIdempotency,
      },
    });
  }

  try {
    const info = await api.startRoomCompositeEgress(
      input.roomName,
      { file: egressFileOutputForCall(input.callId) },
      { audioOnly: true },
    );
    const egressId = info.egressId;
    await prisma.voiceRecording.updateMany({
      where: { callId: input.callId, workspaceId: input.workspaceId },
      data: {
        provider: "livekit",
        status: "processing",
        providerRecordingId: egressId || egressIdempotency,
      },
    });
    return { ok: true, egressId: egressId || undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.voiceRecording.updateMany({
      where: { callId: input.callId, workspaceId: input.workspaceId },
      data: { status: "failed" },
    });
    console.error("VOICE_V3_EGRESS_START_FAILED", {
      callId: input.callId,
      roomName: input.roomName,
      message,
    });
    return { ok: false, skipped: message };
  }
}

export async function getRecordingStatusForCall(callId: string) {
  const prisma = getPrisma();
  return prisma.voiceRecording.findFirst({
    where: { callId },
    orderBy: { createdAt: "desc" },
  });
}
