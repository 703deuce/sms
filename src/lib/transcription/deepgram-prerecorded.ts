import "server-only";

const DEEPGRAM_MODEL = "nova-3";

export type DeepgramPrerecordedOptions = {
  /** Enable speaker diarization for multi-party call recordings. */
  diarize?: boolean;
  language?: string;
};

export type DeepgramTranscriptionResult = {
  text: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  model: string;
  provider: "deepgram";
};

function getDeepgramApiKey(): string | null {
  return process.env.DEEPGRAM_API_KEY?.trim() || null;
}

export function isDeepgramConfigured(): boolean {
  return Boolean(getDeepgramApiKey());
}

/** Prerecorded/batch transcription via Deepgram Nova-3 from a fetchable audio URL. */
export async function transcribeAudioUrlWithDeepgram(
  recordingUrl: string,
  options?: DeepgramPrerecordedOptions,
): Promise<DeepgramTranscriptionResult> {
  const apiKey = getDeepgramApiKey();
  if (!apiKey) {
    return { text: null, model: DEEPGRAM_MODEL, provider: "deepgram" };
  }
  if (!recordingUrl?.trim()) {
    return { text: null, model: DEEPGRAM_MODEL, provider: "deepgram" };
  }

  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    smart_format: "true",
    punctuate: "true",
    language: options?.language || "en",
  });
  if (options?.diarize) {
    params.set("diarize", "true");
    params.set("utterances", "true");
  }

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: recordingUrl }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Deepgram ${res.status}: ${errText.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string; confidence?: number }>;
      }>;
      utterances?: Array<{ transcript?: string }>;
    };
    metadata?: { duration?: number; detected_language?: string };
  };

  let text = "";
  if (options?.diarize && payload.results?.utterances?.length) {
    text = payload.results.utterances
      .map((u) => (u.transcript || "").trim())
      .filter(Boolean)
      .join("\n");
  } else {
    text =
      payload.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
  }

  return {
    text: text || null,
    language: payload.metadata?.detected_language?.trim() || options?.language || "en",
    durationSeconds:
      typeof payload.metadata?.duration === "number" ? payload.metadata.duration : null,
    model: DEEPGRAM_MODEL,
    provider: "deepgram",
  };
}

import { audioSecondsToTranscriptionMinutes } from "./minute-math";

export { audioSecondsToTranscriptionMinutes };
