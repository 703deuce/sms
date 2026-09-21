import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { uploadCallRecordingToStorage } from "@/lib/smart-routing/call-recording-storage";
import { buildVoicemailStorageRecordingUrl } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

function pickTelnyxRecordingUrl(
  recordingUrl: unknown,
): { url: string; format: string } | null {
  if (typeof recordingUrl === "string" && recordingUrl.trim()) {
    return { url: recordingUrl.trim(), format: "mp3" };
  }
  if (recordingUrl && typeof recordingUrl === "object" && !Array.isArray(recordingUrl)) {
    const urls = recordingUrl as Record<string, string>;
    if (urls.mp3?.trim()) return { url: urls.mp3.trim(), format: "mp3" };
    if (urls.wav?.trim()) return { url: urls.wav.trim(), format: "wav" };
  }
  return null;
}

export async function ingestTelnyxVoiceCallRecording(input: {
  workspaceId: string;
  callId: string;
  recordingUrl: unknown;
  providerRecordingId?: string | null;
}): Promise<{ ok: true; recordingId: string; created: boolean } | { ok: false; reason: string }> {
  const prisma = getPrisma();
  const providerId = String(input.providerRecordingId || "").trim();

  if (providerId) {
    const existing = await prisma.voiceRecording.findFirst({
      where: {
        callId: input.callId,
        workspaceId: input.workspaceId,
        providerRecordingId: providerId,
      },
      select: { id: true, status: true },
    });
    if (existing) {
      return { ok: true, recordingId: existing.id, created: false };
    }
  }

  const picked = pickTelnyxRecordingUrl(input.recordingUrl);
  if (!picked) {
    return { ok: false, reason: "no_recording_url" };
  }

  let durableUrl = picked.url;
  let status = "ready";
  try {
    const res = await fetch(picked.url);
    if (!res.ok) {
      throw new Error(`provider_fetch_${res.status}`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const stored = await uploadCallRecordingToStorage({
      workspaceId: input.workspaceId,
      callId: input.callId,
      bytes,
      mimeType: picked.format === "wav" ? "audio/wav" : "audio/mpeg",
      extension: picked.format,
    });
    durableUrl = buildVoicemailStorageRecordingUrl(stored.bucket, stored.path);
    console.log("VOICE_RECORDING_PERSISTED", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      bytes: bytes.length,
    });
  } catch (err) {
    status = "processing";
    console.warn("VOICE_RECORDING_PERSIST_FAILED", {
      callId: input.callId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const placeholder = await prisma.voiceRecording.findFirst({
    where: {
      callId: input.callId,
      workspaceId: input.workspaceId,
      status: { in: ["recording", "pending", "processing"] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const recording = placeholder
    ? await prisma.voiceRecording.update({
        where: { id: placeholder.id },
        data: {
          status,
          storageUrl: durableUrl,
          providerRecordingId: providerId || null,
          format: picked.format,
          channels: 2,
        },
      })
    : await prisma.voiceRecording.create({
        data: {
          workspaceId: input.workspaceId,
          callId: input.callId,
          provider: "telnyx",
          status,
          storageUrl: durableUrl,
          providerRecordingId: providerId || null,
          format: picked.format,
          channels: 2,
        },
      });

  const call = await prisma.voiceCall.findUnique({ where: { id: input.callId } });
  const { publishRecordingReady } = await import("@/lib/crm/events");
  await publishRecordingReady({
    workspaceId: input.workspaceId,
    contactId: call?.contactId || null,
    callId: input.callId,
    recordingUrl: durableUrl,
    direction:
      call?.direction === "OUTBOUND" || call?.direction === "outbound" ? "outbound" : "inbound",
  }).catch(() => undefined);

  await enqueueJob({
    jobType: "voice_v3_call_history",
    queueName: "voice-calls",
    payload: { callId: input.callId, workspaceId: input.workspaceId } as Prisma.InputJsonValue,
    idempotencyKey: `voice-v3-call-history:${input.callId}`,
  }).catch(() => undefined);

  return { ok: true, recordingId: recording.id, created: true };
}
