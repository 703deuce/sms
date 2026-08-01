/**
 * Transcribe a voicemail recording via OpenAI Whisper when OPENAI_API_KEY is set.
 */

import { getOpenAiApiKey } from "@/lib/ai/openai";

export async function transcribeAudioUrl(recordingUrl: string): Promise<string | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !recordingUrl) return null;

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
  form.append("response_format", "text");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const text = (await res.text()).trim();
  return text || null;
}
