/**
 * Server-side ElevenLabs REST client.
 * Never log the API key. Never send the key to the browser.
 */

export class ElevenLabsApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ElevenLabsApiError";
    this.status = status;
    this.body = body;
  }
}

export function getElevenLabsApiKey(): string | null {
  const key =
    process.env.ELEVENLABS_KEY?.trim() ||
    process.env.ELEVENLABS_API_KEY?.trim() ||
    "";
  return key || null;
}

export function isElevenLabsConfigured() {
  return Boolean(getElevenLabsApiKey());
}

async function elevenLabsRequest<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; query?: Record<string, string> },
): Promise<T> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error("ELEVENLABS_KEY is not configured on the server");
  }
  const url = new URL(
    path.startsWith("http") ? path : `https://api.elevenlabs.io${path.startsWith("/") ? "" : "/"}${path}`,
  );
  if (options?.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    method: options?.method || "GET",
    headers: {
      "xi-api-key": apiKey,
      accept: "application/json",
      ...(options?.body ? { "content-type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    const msg =
      (body &&
        typeof body === "object" &&
        "detail" in body &&
        String((body as { detail: unknown }).detail)) ||
      `ElevenLabs HTTP ${res.status}`;
    throw new ElevenLabsApiError(String(msg), res.status, body);
  }
  return body as T;
}

export type ElevenLabsModelInfo = {
  model_id: string;
  name: string;
  can_do_text_to_speech: boolean;
  can_use_style: boolean;
  can_use_speaker_boost: boolean;
  serves_pro_voices: boolean;
  description?: string;
  languages?: Array<{ language_id?: string; name?: string }>;
};

export type ElevenLabsVoiceInfo = {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string | null;
  labels?: Record<string, string>;
};

/** GET /v1/models — discover TTS-capable models on this account. */
export async function listElevenLabsModels(): Promise<ElevenLabsModelInfo[]> {
  const raw = await elevenLabsRequest<unknown>("/v1/models");
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { models?: unknown })?.models)
      ? ((raw as { models: unknown[] }).models as unknown[])
      : [];
  return list
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        model_id: String(r.model_id || ""),
        name: String(r.name || r.model_id || ""),
        can_do_text_to_speech: Boolean(r.can_do_text_to_speech),
        can_use_style: Boolean(r.can_use_style),
        can_use_speaker_boost: Boolean(r.can_use_speaker_boost),
        serves_pro_voices: Boolean(r.serves_pro_voices),
        description: r.description != null ? String(r.description) : undefined,
        languages: Array.isArray(r.languages)
          ? (r.languages as Array<{ language_id?: string; name?: string }>)
          : undefined,
      };
    })
    .filter((m) => m.model_id);
}

/** GET /v1/voices — voices available to the connected account. */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoiceInfo[]> {
  const raw = await elevenLabsRequest<{ voices?: unknown[] }>("/v1/voices");
  const list = Array.isArray(raw?.voices) ? raw.voices : [];
  return list
    .map((row) => {
      const r = row as Record<string, unknown>;
      const labels =
        r.labels && typeof r.labels === "object"
          ? (r.labels as Record<string, string>)
          : undefined;
      return {
        voice_id: String(r.voice_id || ""),
        name: String(r.name || r.voice_id || ""),
        category: r.category != null ? String(r.category) : undefined,
        description: r.description != null ? String(r.description) : undefined,
        preview_url:
          r.preview_url != null && String(r.preview_url)
            ? String(r.preview_url)
            : null,
        labels,
      };
    })
    .filter((v) => v.voice_id);
}

/** Direct ElevenLabs TTS preview (server-side only). */
export async function synthesizeElevenLabsPreview(input: {
  voiceId: string;
  modelId: string;
  text: string;
}): Promise<ArrayBuffer> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) throw new Error("ELEVENLABS_KEY is not configured on the server");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: input.text.slice(0, 500),
        model_id: input.modelId,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep text
    }
    throw new ElevenLabsApiError(`ElevenLabs TTS HTTP ${res.status}`, res.status, body);
  }
  return res.arrayBuffer();
}
