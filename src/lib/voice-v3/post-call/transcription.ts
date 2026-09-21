import "server-only";

import { getPrisma } from "@/lib/db";
import { createDeepgramAccessibleRecordingUrl } from "@/lib/voice/recordings";

export type TranscriptTurn = {
  speaker: "CALLER" | "AGENT" | "UNKNOWN";
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
};

const DEEPGRAM_MODEL = process.env.VOICE_V3_POST_CALL_DEEPGRAM_MODEL?.trim() || "nova-3";

function mapSpeaker(channel: number | undefined, diarized: number | undefined): TranscriptTurn["speaker"] {
  if (channel === 0) return "CALLER";
  if (channel === 1) return "AGENT";
  if (diarized === 0) return "CALLER";
  if (diarized === 1) return "AGENT";
  return "UNKNOWN";
}

export async function transcribeRecordingWithDeepgram(input: {
  workspaceId: string;
  callId: string;
  recordingId: string;
  audioUrl?: string | null;
  channels?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "DEEPGRAM_API_KEY not configured" };
  }

  const prisma = getPrisma();
  let transcript = await prisma.voiceTranscript.findFirst({
    where: { callId: input.callId, workspaceId: input.workspaceId },
  });
  if (transcript?.status === "completed" && transcript.fullText?.trim()) {
    return { ok: true };
  }

  if (!transcript) {
    transcript = await prisma.voiceTranscript.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        provider: "deepgram",
        status: "processing",
      },
    });
  } else {
    await prisma.voiceTranscript.update({
      where: { id: transcript.id },
      data: { status: "processing", provider: "deepgram" },
    });
  }

  const prismaRec = await prisma.voiceRecording.findFirst({
    where: { id: input.recordingId, workspaceId: input.workspaceId },
  });
  const audioUrl =
    input.audioUrl?.trim() ||
    createDeepgramAccessibleRecordingUrl(input.recordingId, input.workspaceId) ||
    prismaRec?.storageUrl ||
    null;
  if (!audioUrl) {
    return { ok: false, error: "recording_url_unavailable" };
  }

  const multichannel = (input.channels ?? prismaRec?.channels ?? 2) >= 2;
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    smart_format: "true",
    utterances: "true",
    diarize: multichannel ? "false" : "true",
  });
  if (multichannel) params.set("multichannel", "true");

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!res.ok) {
    const body = await res.text();
    await prisma.voiceTranscript.update({
      where: { id: transcript.id },
      data: {
        status: "failed",
        errorMessage: body.slice(0, 2000),
        retryCount: { increment: 1 },
      },
    });
    return { ok: false, error: `Deepgram ${res.status}` };
  }

  const data = (await res.json()) as Record<string, unknown>;
  const results = data.results as Record<string, unknown> | undefined;
  const utterances = (results?.utterances as Array<Record<string, unknown>>) || [];
  const turns: TranscriptTurn[] = [];
  const lines: string[] = [];

  for (const u of utterances) {
    const text = String(u.transcript || "").trim();
    if (!text) continue;
    const start = typeof u.start === "number" ? Math.round(u.start * 1000) : undefined;
    const end = typeof u.end === "number" ? Math.round(u.end * 1000) : undefined;
    const channel = typeof u.channel === "number" ? u.channel : undefined;
    const speaker = mapSpeaker(channel, typeof u.speaker === "number" ? u.speaker : undefined);
    turns.push({ speaker, text, startMs: start, endMs: end, confidence: typeof u.confidence === "number" ? u.confidence : undefined });
    lines.push(`${speaker}: ${text}`);
  }

  if (!turns.length) {
    const alt = results?.channels as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(alt)) {
      alt.forEach((ch, idx) => {
        const alts = ch.alternatives as Array<Record<string, unknown>> | undefined;
        const text = String(alts?.[0]?.transcript || "").trim();
        if (!text) return;
        const speaker = idx === 0 ? "CALLER" : "AGENT";
        turns.push({ speaker, text });
        lines.push(`${speaker}: ${text}`);
      });
    }
  }

  const plainText = lines.join("\n");

  await prisma.voiceTranscriptSegment.deleteMany({ where: { transcriptId: transcript.id } });
  if (turns.length) {
    await prisma.voiceTranscriptSegment.createMany({
      data: turns.map((t) => ({
        workspaceId: input.workspaceId,
        transcriptId: transcript.id,
        speaker: t.speaker,
        text: t.text,
        startMs: t.startMs ?? null,
        endMs: t.endMs ?? null,
        confidence: t.confidence ?? null,
      })),
    });
  }

  await prisma.voiceTranscript.update({
    where: { id: transcript.id },
    data: {
      status: "completed",
      fullText: plainText,
      language: "en",
      errorMessage: null,
    },
  });

  return { ok: true };
}
