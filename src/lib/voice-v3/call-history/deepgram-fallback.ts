import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isDeepgramConfigured,
  transcribeAudioUrlWithDeepgram,
} from "@/lib/transcription/deepgram-prerecorded";
import { createSignedRecordingUrl } from "@/lib/smart-routing/call-recording-storage";
import { parseVoicemailStorageRecordingUrl } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";

type DeepgramUtterance = {
  transcript?: string;
  channel?: number;
  speaker?: number;
  start?: number;
  end?: number;
};

async function resolvePlaybackUrl(storageUrl: string): Promise<string> {
  const parsed = parseVoicemailStorageRecordingUrl(storageUrl);
  if (parsed) {
    return createSignedRecordingUrl(parsed.bucket, parsed.path, 900);
  }
  return storageUrl;
}

function mapSpeaker(channel: number | undefined, channels: number): "caller" | "agent" {
  if (channels > 1) {
    return channel === 0 ? "caller" : "agent";
  }
  return channel === 1 ? "agent" : "caller";
}

export async function runDeepgramFallbackForCall(input: {
  workspaceId: string;
  callId: string;
  recordingId: string;
  storageUrl: string;
  channels?: number | null;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  if (!isDeepgramConfigured()) {
    return { ok: false, skipped: true, reason: "deepgram_not_configured" };
  }

  const prisma = getPrisma();
  const existing = await prisma.voiceTranscript.findFirst({
    where: { callId: input.callId, workspaceId: input.workspaceId, provider: "deepgram" },
    select: { id: true, status: true },
  });
  if (existing?.status === "completed") {
    return { ok: true, skipped: true, reason: "already_completed" };
  }

  const playbackUrl = await resolvePlaybackUrl(input.storageUrl);
  const channels = input.channels && input.channels > 1 ? input.channels : 2;
  const useMultichannel = channels > 1;

  console.log("VOICE_TRANSCRIPT_DEEPGRAM_STARTED", {
    callId: input.callId,
    recordingId: input.recordingId,
    multichannel: useMultichannel,
  });

  const started = Date.now();
  const result = await transcribeAudioUrlWithDeepgram(playbackUrl, {
    multichannel: useMultichannel,
    diarize: !useMultichannel,
    language: "en",
  });

  const raw = result.raw as {
    results?: { utterances?: DeepgramUtterance[] };
  } | undefined;
  const utterances = raw?.results?.utterances || [];

  const segments =
    utterances.length > 0
      ? utterances
          .map((u, idx) => {
            const text = (u.transcript || "").trim();
            if (!text) return null;
            const speaker = useMultichannel
              ? mapSpeaker(u.channel, channels)
              : u.speaker === 0
                ? "caller"
                : "agent";
            const startMs =
              typeof u.start === "number" ? Math.round(u.start * 1000) : idx * 1000;
            const endMs =
              typeof u.end === "number" ? Math.round(u.end * 1000) : startMs + 800;
            return { speaker, text, startMs, endMs };
          })
          .filter(Boolean) as Array<{
          speaker: string;
          text: string;
          startMs: number;
          endMs: number;
        }>
      : [];

  const fullText =
    segments.length > 0
      ? segments.map((s) => `${s.speaker}: ${s.text}`).join("\n")
      : result.fullText || result.text || "";

  if (!fullText.trim()) {
    await prisma.voiceTranscript.updateMany({
      where: { callId: input.callId, workspaceId: input.workspaceId },
      data: {
        status: "failed",
        errorMessage: "deepgram_empty",
        provider: "deepgram",
      },
    });
    console.warn("VOICE_TRANSCRIPT_FAILED", { callId: input.callId, reason: "deepgram_empty" });
    return { ok: false, reason: "deepgram_empty" };
  }

  const transcript =
    existing ??
    (await prisma.voiceTranscript.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        provider: "deepgram",
        status: "processing",
      },
      select: { id: true },
    }));

  await prisma.voiceTranscript.update({
    where: { id: transcript.id },
    data: {
      provider: "deepgram",
      status: "completed",
      fullText,
      durationSeconds: result.durationSeconds ?? undefined,
      errorMessage: null,
    },
  });

  await prisma.voiceTranscriptSegment.deleteMany({ where: { transcriptId: transcript.id } });
  if (segments.length) {
    await prisma.voiceTranscriptSegment.createMany({
      data: segments.map((s) => ({
        workspaceId: input.workspaceId,
        transcriptId: transcript.id,
        speaker: s.speaker,
        text: s.text,
        startMs: s.startMs,
        endMs: s.endMs,
      })),
    });
  }

  console.log("VOICE_TRANSCRIPT_DEEPGRAM_COMPLETED", {
    callId: input.callId,
    elapsed_ms: Date.now() - started,
    segments: segments.length,
  });

  return { ok: true };
}
