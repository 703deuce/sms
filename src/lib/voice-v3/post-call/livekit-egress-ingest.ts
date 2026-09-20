import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueVoiceV3PostCallJob } from "./enqueue";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function pickRecordingUrl(egress: Record<string, unknown>): string | null {
  const fileResults = egress.fileResults as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(fileResults) && fileResults.length) {
    for (const f of fileResults) {
      const loc = String(f.location || f.downloadUrl || "").trim();
      if (loc) return loc;
    }
  }
  const file = asRecord(egress.file);
  const loc = String(file.location || file.filename || "").trim();
  return loc || null;
}

/** Persist LiveKit egress completion onto VoiceRecording and continue post-call pipeline. */
export async function ingestLiveKitEgressEnded(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
  const egress = asRecord(payload.egressInfo ?? payload.egress ?? payload);
  const egressId = String(egress.egressId || egress.id || "").trim();
  const roomName = String(egress.roomName || egress.room_name || "").trim();
  const status = String(egress.status || "").toLowerCase();
  const storageUrl = pickRecordingUrl(egress);

  const prisma = getPrisma();
  let recording = egressId
    ? await prisma.voiceRecording.findFirst({
        where: { provider: "livekit", providerRecordingId: egressId },
      })
    : null;

  if (!recording && roomName) {
    const call = await prisma.voiceCall.findFirst({
      where: {
        metadata: { path: ["livekitRoomName"], equals: roomName },
      },
      select: { id: true, workspaceId: true },
      orderBy: { createdAt: "desc" },
    });
    if (call) {
      recording = await prisma.voiceRecording.findFirst({
        where: { callId: call.id },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  if (!recording) {
    console.warn("LIVEKIT_EGRESS_INGEST_NO_RECORDING_ROW", { egressId, roomName });
    return { ok: false };
  }

  const failed = status.includes("failed") || status.includes("aborted");
  await prisma.voiceRecording.update({
    where: { id: recording.id },
    data: {
      status: failed ? "failed" : storageUrl ? "ready" : "processing",
      storageUrl: storageUrl || recording.storageUrl,
      format: storageUrl?.endsWith(".ogg") ? "ogg" : recording.format,
      providerRecordingId: egressId || recording.providerRecordingId,
      durationSeconds:
        typeof egress.duration === "number"
          ? Math.round(egress.duration)
          : recording.durationSeconds,
    },
  });

  if (!failed && storageUrl) {
    await enqueueVoiceV3PostCallJob({
      workspaceId: recording.workspaceId,
      callId: recording.callId,
      delaySeconds: 5,
    });
  }

  return { ok: true };
}
