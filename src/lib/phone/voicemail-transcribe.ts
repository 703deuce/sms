/**
 * Transcribe a voicemail recording via OpenAI Whisper when OPENAI_API_KEY is set.
 */

import { getOpenAiApiKey } from "@/lib/ai/openai";

export type VoicemailTranscriptionResult = {
  text: string | null;
  language?: string | null;
};

export async function transcribeAudioUrl(
  recordingUrl: string,
): Promise<VoicemailTranscriptionResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !recordingUrl) return { text: null };

  const audioRes = await fetch(recordingUrl);
  if (!audioRes.ok) {
    throw new Error(`Failed to fetch recording (${audioRes.status})`);
  }
  const blob = await audioRes.blob();
  const contentType = blob.type || "audio/mpeg";
  const ext = contentType.includes("wav") ? "wav" : contentType.includes("ogg") ? "ogg" : "mp3";
  const form = new FormData();
  form.append("file", blob, `voicemail.${ext}`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { text?: string; language?: string };
  const text = (payload.text || "").trim();
  return {
    text: text || null,
    language: payload.language?.trim() || null,
  };
}
