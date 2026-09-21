import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import {
  isDeepgramConfigured,
  transcribeAudioUrlWithDeepgram,
} from "@/lib/transcription/deepgram-prerecorded";
import { createSignedRecordingUrl } from "@/lib/smart-routing/call-recording-storage";
import { parseVoicemailStorageRecordingUrl } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";
import {
  mapChannelRoleToSegmentSpeaker,
  resolveDualChannelSpeakerMap,
} from "./channel-semantics";

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

function nativeSpeakerBuckets(
  segments: Array<{ speaker: string; text: string }>,
): { callerText: string; agentText: string } {
  let callerText = "";
  let agentText = "";
  for (const seg of segments) {
    const s = seg.speaker.toLowerCase();
    if (s.includes("caller") || s === "user") callerText += ` ${seg.text}`;
    else if (s.includes("agent") || s.includes("assistant")) agentText += ` ${seg.text}`;
  }
  return { callerText: callerText.trim(), agentText: agentText.trim() };
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

  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { direction: true, metadata: true },
  });

  const meta =
    call?.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const certMap = (meta.callHistoryCert as { channelMap?: Record<string, "caller" | "agent"> })
    ?.channelMap;

  const nativeTranscript = await prisma.voiceTranscript.findFirst({
    where: {
      callId: input.callId,
      workspaceId: input.workspaceId,
      provider: { in: ["voice_v3_livekit", "livekit"] },
    },
    include: { segments: true },
  });
  const { callerText, agentText } = nativeSpeakerBuckets(nativeTranscript?.segments ?? []);

  const playbackUrl = await resolvePlaybackUrl(input.storageUrl);
  const channels = input.channels && input.channels > 1 ? input.channels : 2;
  const useMultichannel = channels > 1;

  console.log("VOICE_TRANSCRIPT_DEEPGRAM_STARTED", {
    callId: input.callId,
    recordingId: input.recordingId,
    multichannel: useMultichannel,
    diarize_model: useMultichannel ? null : "latest",
  });

  const started = Date.now();
  const result = await transcribeAudioUrlWithDeepgram(playbackUrl, {
    multichannel: useMultichannel,
    diarize: !useMultichannel,
    language: "en",
  });

  const raw = result.raw as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
      utterances?: DeepgramUtterance[];
    };
  } | undefined;

  const channelTexts =
    raw?.results?.channels?.map((ch, idx) => ({
      channel: idx,
      text: ch.alternatives?.[0]?.transcript?.trim() || "",
    })) ?? [];

  const channelMap = useMultichannel
    ? resolveDualChannelSpeakerMap({
        channelTexts,
        nativeCallerText: callerText,
        nativeAgentText: agentText,
        callDirection: call?.direction,
        certChannelMap: certMap ?? null,
      })
    : null;

  const utterances = raw?.results?.utterances || [];

  let segments: Array<{ speaker: string; text: string; startMs: number; endMs: number }> = [];

  if (useMultichannel && utterances.length > 0) {
    segments = utterances
      .map((u, idx) => {
        const text = (u.transcript || "").trim();
        if (!text) return null;
        const ch = u.channel ?? 0;
        const role = channelMap?.byChannel[ch] ?? `channel_${ch}`;
        const speaker = mapChannelRoleToSegmentSpeaker(role);
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
    }>;
  } else if (!useMultichannel && utterances.length > 0) {
    segments = utterances
      .map((u, idx) => {
        const text = (u.transcript || "").trim();
        if (!text) return null;
        const speaker = u.speaker === 1 ? "agent" : "caller";
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
    }>;
  }

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

  if (channelMap) {
    await prisma.voiceCall.update({
      where: { id: input.callId },
      data: {
        metadata: {
          ...meta,
          recordingChannelSemantics: {
            source: channelMap.source,
            confidence: channelMap.confidence,
            byChannel: channelMap.byChannel,
            channelPreview: channelTexts.map((c) => ({
              channel: c.channel,
              excerpt: c.text.slice(0, 120),
            })),
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  console.log("VOICE_TRANSCRIPT_DEEPGRAM_COMPLETED", {
    callId: input.callId,
    elapsed_ms: Date.now() - started,
    segments: segments.length,
    channel_semantics: channelMap?.source,
  });

  return { ok: true };
}
