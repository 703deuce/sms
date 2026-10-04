import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { transcribeAudioUrlWithDeepgram } from "./deepgram-prerecorded";
import {
  isTelnyxAudioTranscriptionConfigured,
  transcribeAudioUrlWithTelnyx,
} from "./telnyx-audio";
import { canTranscribeRecording } from "./entitlement";
import { recordTranscriptionUsage } from "./usage";
import { resolveVoicemailRecordingFetchUrl } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-service";

export type TranscriptionSourceType = "voicemail_message" | "smart_routing_recording";

export async function enqueueTranscriptionJob(input: {
  workspaceId: string;
  sourceType: TranscriptionSourceType;
  sourceId: string;
  recordingUrl: string;
  provider?: string;
  durationSeconds?: number | null;
  diarize?: boolean;
  /** Voicemail clips are short — skip paid add-on gates when true. */
  bypassEntitlement?: boolean;
}): Promise<{ queued: boolean; reason?: string }> {
  const skipEntitlement =
    input.bypassEntitlement === true || input.sourceType === "voicemail_message";
  if (!skipEntitlement) {
    const gate = await canTranscribeRecording({
      workspaceId: input.workspaceId,
      estimatedMinutes: input.durationSeconds
        ? Math.max(1, Math.ceil(input.durationSeconds / 60))
        : 1,
    });
    if (!gate.allowed) {
      await markTranscriptionSkipped(input.sourceType, input.sourceId, gate.reason || "skipped");
      return { queued: false, reason: gate.reason };
    }
  }

  const idempotencyKey = `ai-transcription:${input.sourceType}:${input.sourceId}`;

  const prisma = getPrisma();
  if (input.sourceType === "voicemail_message") {
    const vm = await prisma.voicemailMessage.findFirst({
      where: { id: input.sourceId, workspaceId: input.workspaceId },
      select: { transcriptStatus: true, transcriptText: true },
    });
    if (vm?.transcriptStatus === "completed" && vm.transcriptText?.trim()) {
      return { queued: false, reason: "already_transcribed" };
    }
    if (vm?.transcriptStatus === "processing") {
      const existingJob = await prisma.jobQueue.findUnique({ where: { idempotencyKey } });
      if (
        existingJob &&
        (existingJob.status === "pending" ||
          existingJob.status === "deferred" ||
          existingJob.status === "processing")
      ) {
        return { queued: false, reason: "already_queued" };
      }
    }
  }

  await markTranscriptionPending(input.sourceType, input.sourceId);

  await enqueueJob({
    jobType: "ai_transcription_run",
    queueName: "automations",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      recordingUrl: input.recordingUrl,
      provider: input.provider ?? null,
      durationSeconds: input.durationSeconds ?? null,
      diarize: input.diarize ?? false,
    },
    idempotencyKey,
    runAfter: new Date(),
  });

  return { queued: true };
}

async function markTranscriptionPending(sourceType: TranscriptionSourceType, sourceId: string) {
  const prisma = getPrisma();
  if (sourceType === "voicemail_message") {
    await prisma.voicemailMessage.updateMany({
      where: { id: sourceId, transcriptStatus: { in: [null, "pending", "failed"] } },
      data: { transcriptStatus: "processing", transcriptionError: null },
    });
  } else {
    await prisma.smartRoutingCallRecording.updateMany({
      where: { id: sourceId, transcriptStatus: { in: ["pending", "processing"] } },
      data: { transcriptStatus: "processing" },
    });
  }
}

async function markTranscriptionSkipped(
  sourceType: TranscriptionSourceType,
  sourceId: string,
  reason: string,
) {
  const prisma = getPrisma();
  const status = reason === "limit_reached" ? "limit_reached" : "disabled";
  if (sourceType === "voicemail_message") {
    await prisma.voicemailMessage.update({
      where: { id: sourceId },
      data: {
        transcriptStatus: status,
        transcriptionError:
          reason === "limit_reached"
            ? "Transcription limit reached for this billing period"
            : null,
      },
    });
  } else {
    await prisma.smartRoutingCallRecording.update({
      where: { id: sourceId },
      data: { transcriptStatus: status },
    });
  }
}

export async function executeTranscriptionJob(input: {
  workspaceId: string;
  sourceType: TranscriptionSourceType;
  sourceId: string;
  recordingUrl: string;
  provider?: string | null;
  durationSeconds?: number | null;
  diarize?: boolean;
  bypassEntitlement?: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  const prisma = getPrisma();
  const idempotencyKey = `ai-transcription:${input.sourceType}:${input.sourceId}`;

  const existingUsage = await prisma.platformTranscriptionUsageRecord.findUnique({
    where: { idempotencyKey },
  });
  if (existingUsage?.status === "completed") {
    return { ok: true, reason: "already_completed" };
  }

  if (input.sourceType === "voicemail_message") {
    const msg = await prisma.voicemailMessage.findFirst({
      where: { id: input.sourceId, workspaceId: input.workspaceId },
    });
    if (!msg) return { ok: false, reason: "not_found" };
    if (msg.transcriptStatus === "completed" && msg.transcriptText) {
      return { ok: true, reason: "already_transcribed" };
    }
  } else {
    const rec = await prisma.smartRoutingCallRecording.findFirst({
      where: { id: input.sourceId, workspaceId: input.workspaceId },
    });
    if (!rec) return { ok: false, reason: "not_found" };
    if (rec.transcriptStatus === "completed" && rec.transcriptText) {
      return { ok: true, reason: "already_transcribed" };
    }
  }

  const skipEntitlement =
    input.bypassEntitlement === true || input.sourceType === "voicemail_message";
  if (!skipEntitlement) {
    const gate = await canTranscribeRecording({
      workspaceId: input.workspaceId,
      estimatedMinutes: input.durationSeconds
        ? Math.max(1, Math.ceil(input.durationSeconds / 60))
        : 1,
    });
    if (!gate.allowed) {
      await markTranscriptionSkipped(input.sourceType, input.sourceId, gate.reason || "skipped");
      return { ok: false, reason: gate.reason };
    }
  }

  try {
    const fetchUrl = await resolveVoicemailRecordingFetchUrl(input.recordingUrl);
    const useTelnyxForVoicemail =
      input.sourceType === "voicemail_message" && isTelnyxAudioTranscriptionConfigured();
    const result = useTelnyxForVoicemail
      ? await transcribeAudioUrlWithTelnyx(fetchUrl)
      : await transcribeAudioUrlWithDeepgram(fetchUrl, {
          diarize: input.diarize,
        });
    const transcript = result.text?.trim() || null;
    if (!transcript) {
      throw new Error("empty_transcript");
    }

    const usage = await recordTranscriptionUsage({
      workspaceId: input.workspaceId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      provider: input.provider,
      audioDurationSeconds: result.durationSeconds ?? input.durationSeconds,
      idempotencyKey,
      status: "completed",
    });

    if (input.sourceType === "voicemail_message") {
      const { summarizeVoicemailTranscript, translateVoicemailToEnglish } = await import(
        "@/lib/phone/voicemail-post-process"
      );
      const transcriptEnglish = await translateVoicemailToEnglish(transcript, result.language);
      const aiSummary = await summarizeVoicemailTranscript(transcript);
      await prisma.voicemailMessage.update({
        where: { id: input.sourceId },
        data: {
          transcriptText: transcript,
          transcriptEnglish: transcriptEnglish ?? null,
          aiSummary: aiSummary ?? null,
          transcriptStatus: "completed",
          transcriptionMinutes: usage.minutes,
          transcriptionProvider: result.provider,
          transcriptionModel: result.model,
          transcriptionError: null,
        },
      });
      const msg = await prisma.voicemailMessage.findUnique({ where: { id: input.sourceId } });
      if (msg) {
        const { notifyWorkspace } = await import("@/lib/notifications/in-app");
        await notifyWorkspace(input.workspaceId, {
          type: "voicemail_transcript",
          title: "Voicemail transcript ready",
          body: `Transcript ready for ${msg.fromE164 || "unknown caller"}`,
          href: "/personal/voicemail",
        }).catch(() => undefined);
      }
    } else {
      await prisma.smartRoutingCallRecording.update({
        where: { id: input.sourceId },
        data: {
          transcriptText: transcript,
          transcriptStatus: "completed",
        },
      });
      const { queueRecordingSummary } = await import("@/lib/smart-routing/call-recording-pipeline");
      await queueRecordingSummary(input.sourceId, transcript);
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "transcription_failed";
    if (input.sourceType === "voicemail_message") {
      await prisma.voicemailMessage.update({
        where: { id: input.sourceId },
        data: {
          transcriptStatus: "failed",
          transcriptionError: message,
        },
      });
    } else {
      await prisma.smartRoutingCallRecording.update({
        where: { id: input.sourceId },
        data: { transcriptStatus: "failed" },
      });
    }
    await recordTranscriptionUsage({
      workspaceId: input.workspaceId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      provider: input.provider,
      audioDurationSeconds: input.durationSeconds,
      transcriptionMinutes: 0,
      idempotencyKey: `${idempotencyKey}:failed`,
      status: "failed",
      errorMessage: message,
    }).catch(() => undefined);
    throw err;
  }
}
