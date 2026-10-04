import "server-only";

import { assertTelnyxConfigured, getTelnyxApiBaseUrl } from "@/lib/messaging/telnyx/config";

/** @see https://developers.telnyx.com/api-reference/audio/transcribe-speech-to-text */
const DEFAULT_VOICEMAIL_STT_MODEL =
  process.env.TELNYX_VOICEMAIL_TRANSCRIPTION_MODEL?.trim() ||
  "openai/whisper-large-v3-turbo";

export type TelnyxAudioTranscriptionResult = {
  text: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  model: string;
  provider: "telnyx";
};

export function isTelnyxAudioTranscriptionConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY?.trim());
}

function guessAudioFilename(recordingUrl: string): string {
  const lower = recordingUrl.toLowerCase();
  if (lower.includes(".wav")) return "voicemail.wav";
  if (lower.includes(".ogg")) return "voicemail.ogg";
  if (lower.includes(".m4a")) return "voicemail.m4a";
  if (lower.includes(".webm")) return "voicemail.webm";
  return "voicemail.mp3";
}

function guessAudioMime(filename: string): string {
  if (filename.endsWith(".wav")) return "audio/wav";
  if (filename.endsWith(".ogg")) return "audio/ogg";
  if (filename.endsWith(".m4a")) return "audio/mp4";
  if (filename.endsWith(".webm")) return "audio/webm";
  return "audio/mpeg";
}

async function downloadRecording(recordingUrl: string): Promise<{ buffer: Buffer; filename: string }> {
  const res = await fetch(recordingUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`recording_fetch_${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const filename = guessAudioFilename(recordingUrl);
  return { buffer: Buffer.from(arrayBuffer), filename };
}

/**
 * Voicemail / short prerecorded audio via Telnyx Inference `POST /ai/audio/transcriptions`.
 * Uses multipart upload so private signed URLs work (Telnyx fetches via our server).
 */
export async function transcribeAudioUrlWithTelnyx(
  recordingUrl: string,
  options?: { model?: string; language?: string },
): Promise<TelnyxAudioTranscriptionResult> {
  const { apiKey } = assertTelnyxConfigured();
  const base = getTelnyxApiBaseUrl();
  const model = options?.model?.trim() || DEFAULT_VOICEMAIL_STT_MODEL;

  if (!recordingUrl?.trim()) {
    return { text: null, model, provider: "telnyx" };
  }

  const { buffer, filename } = await downloadRecording(recordingUrl);
  if (!buffer.length) {
    throw new Error("empty_recording");
  }

  const form = new FormData();
  form.append("model", model);
  form.append(
    "file",
    new Blob([buffer], { type: guessAudioMime(filename) }),
    filename,
  );
  if (options?.language?.trim()) {
    form.append("language", options.language.trim());
  }
  form.append("response_format", "verbose_json");

  const res = await fetch(`${base}/ai/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Telnyx STT ${res.status}: ${errText.slice(0, 400)}`);
  }

  const payload = (await res.json()) as {
    text?: string;
    duration?: number;
  };

  const text = payload.text?.trim() || null;
  return {
    text,
    durationSeconds: typeof payload.duration === "number" ? payload.duration : null,
    model,
    provider: "telnyx",
    language: options?.language || null,
  };
}
