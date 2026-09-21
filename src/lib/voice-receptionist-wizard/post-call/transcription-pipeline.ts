import "server-only";

import { getPrisma } from "@/lib/db";
import { isVoiceV3CallHistoryEligible } from "@/lib/voice-v3/call-history/post-call-pipeline";
import { runDeepgramFallbackForCall } from "@/lib/voice-v3/call-history/deepgram-fallback";
import { validateNativeCustomerTranscript } from "@/lib/voice-v3/call-history/native-transcript-validator";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { Prisma } from "@/lib/domain";

export function deepgramApiKeyConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
}

export async function callUsesVoiceV2PostCallPipeline(callId: string): Promise<boolean> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  return call ? isVoiceV3CallHistoryEligible(call.metadata) : false;
}

export async function enqueueVoiceV2PostCallTranscription(input: {
  workspaceId: string;
  callId: string;
  recordingId: string;
  recordingUrl: string;
  channels?: number | null;
}): Promise<void> {
  await enqueueJob({
    jobType: "voice_v2_post_call_transcription",
    queueName: "voice-calls",
    payload: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      recordingId: input.recordingId,
      recordingUrl: input.recordingUrl,
      channels: input.channels ?? 2,
    } as Prisma.InputJsonValue,
    idempotencyKey: `voice-v2-post-call-tx:${input.callId}:${input.recordingId}`,
  });
}

export async function executeVoiceV2PostCallTranscriptionJob(
  payload: Record<string, unknown>,
): Promise<{ ok: true; skipped?: boolean }> {
  const workspaceId = String(payload.workspaceId || "");
  const callId = String(payload.callId || "");
  const recordingId = String(payload.recordingId || "");
  const recordingUrl = String(payload.recordingUrl || "");
  const channels = Number(payload.channels || 2);

  if (!workspaceId || !callId || !recordingId || !recordingUrl) {
    throw new Error("workspaceId, callId, recordingId, recordingUrl required");
  }

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    select: { metadata: true, durationSeconds: true },
  });
  if (!call) return { ok: true, skipped: true };

  const transcripts = await prisma.voiceTranscript.findMany({
    where: { callId, workspaceId },
    include: { segments: true },
  });
  const native = transcripts.find(
    (t) => t.provider === "voice_v3_livekit" || t.provider === "livekit",
  );
  if (native) {
    const validation = validateNativeCustomerTranscript({
      segments: native.segments,
      durationSeconds: call.durationSeconds,
      forensicsFinal: true,
    });
    if (validation.valid) {
      return { ok: true, skipped: true };
    }
  }

  await runDeepgramFallbackForCall({
    workspaceId,
    callId,
    recordingId,
    storageUrl: recordingUrl,
    channels,
  });

  await enqueueJob({
    jobType: "voice_v3_call_history",
    queueName: "voice-calls",
    payload: { callId, workspaceId } as Prisma.InputJsonValue,
    idempotencyKey: `voice-v3-call-history:${callId}`,
  }).catch(() => undefined);

  return { ok: true };
}
