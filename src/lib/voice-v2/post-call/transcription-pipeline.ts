import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  isDeepgramConfigured,
  transcribeAudioUrlWithDeepgram,
} from "@/lib/transcription/deepgram-prerecorded";
import { isVoiceV2PstnOneAmyMode } from "../pstn-workflow-mode";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { VoiceV2MultichannelTranscript } from "./types";
import { runVoiceV2PostCallReconciliationJob } from "./reconciliation-job";

export function deepgramApiKeyConfigured(): boolean {
  return isDeepgramConfigured();
}

export async function callUsesVoiceV2PostCallPipeline(callId: string): Promise<boolean> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { agentId: true, agentVersionId: true, metadata: true },
  });
  if (!call?.agentId) return false;
  const meta = (call.metadata || {}) as Record<string, unknown>;
  if (meta.voiceV2OneAmy === true || meta.voiceV2PostCall === true) return true;

  if (call.agentVersionId) {
    const ver = await prisma.voiceAgentVersion.findUnique({
      where: { id: call.agentVersionId },
      select: { config: true },
    });
    if (ver?.config && isVoiceV2PstnOneAmyMode(parseVoiceAgentConfig(ver.config))) return true;
  }
  const agent = await prisma.voiceAgent.findUnique({
    where: { id: call.agentId },
    select: { draftConfig: true },
  });
  if (agent?.draftConfig && isVoiceV2PstnOneAmyMode(parseVoiceAgentConfig(agent.draftConfig))) {
    return true;
  }
  return false;
}

export async function enqueueVoiceV2PostCallTranscription(input: {
  workspaceId: string;
  callId: string;
  recordingId: string;
  recordingUrl: string;
  channels?: number;
}): Promise<{ queued: boolean; reason?: string }> {
  const eligible = await callUsesVoiceV2PostCallPipeline(input.callId);
  if (!eligible) return { queued: false, reason: "not_voice_v2" };
  if (!deepgramApiKeyConfigured()) {
    await markPostCallTranscriptionStatus(input.callId, "FAILED", "deepgram_not_configured");
    return { queued: false, reason: "deepgram_not_configured" };
  }

  await markPostCallTranscriptionStatus(input.callId, "PENDING");
  await enqueueJob({
    jobType: "voice_v2_post_call_transcription",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      recordingId: input.recordingId,
      recordingUrl: input.recordingUrl,
      channels: input.channels ?? 2,
    },
    idempotencyKey: `voice-v2-post-call-tx:${input.callId}:${input.recordingId}`,
    runAfter: new Date(),
  });
  return { queued: true };
}

async function markPostCallTranscriptionStatus(
  callId: string,
  status: string,
  lastError?: string,
) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId }, select: { metadata: true } });
  const prev = (call?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...prev,
        voiceV2PostCallTranscription: {
          status,
          lastError: lastError || null,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });
}

export async function executeVoiceV2PostCallTranscriptionJob(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const callId = String(payload.callId || "");
  const recordingUrl = String(payload.recordingUrl || "");
  const channels = Number(payload.channels || 2);
  if (!workspaceId || !callId || !recordingUrl) {
    throw new Error("workspaceId, callId, recordingUrl required");
  }

  const call = await getPrisma().voiceCall.findFirst({
    where: { id: callId, workspaceId },
  });
  if (!call) throw new Error("call_not_found");

  await markPostCallTranscriptionStatus(callId, "SUBMITTED");

  const result = await transcribeAudioUrlWithDeepgram(recordingUrl, {
    multichannel: channels > 1,
    language: "en-US",
  });

  if (!result.text) {
    await markPostCallTranscriptionStatus(callId, "FAILED", "empty_transcript");
    return { ok: false, reason: "empty_transcript" };
  }

  const multichannel: VoiceV2MultichannelTranscript = {
    provider: "deepgram",
    model: result.model,
    fullText: result.fullText || result.text,
    callerText: result.channelTexts?.caller || result.text,
    agentText: result.channelTexts?.agent || "",
    requestId: result.requestId,
    raw: result.raw,
  };

  const prisma = getPrisma();
  const transcript = await prisma.voiceTranscript.create({
    data: {
      workspaceId,
      callId,
      provider: "deepgram_post_call_v2",
      status: "completed",
      language: result.language || "en",
      fullText: multichannel.fullText,
      confidence: null,
      durationSeconds: result.durationSeconds ? Math.round(result.durationSeconds) : null,
    },
  });

  const prevMeta = (call.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...prevMeta,
        voiceV2PostCallTranscription: {
          status: "COMPLETED",
          transcriptId: transcript.id,
          model: result.model,
          completedAt: new Date().toISOString(),
        },
        voiceV2PostCallTranscript: {
          callerText: multichannel.callerText,
          agentText: multichannel.agentText,
        },
      },
    },
  });

  await runVoiceV2PostCallReconciliationJob({
    workspaceId,
    callId,
    transcript: multichannel,
  });

  return { ok: true, transcriptId: transcript.id };
}
