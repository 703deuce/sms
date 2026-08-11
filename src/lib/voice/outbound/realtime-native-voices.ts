/** OpenAI Realtime built-in voices (gpt-realtime family). */
export const OPENAI_REALTIME_NATIVE_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export type OpenAiRealtimeNativeVoice = (typeof OPENAI_REALTIME_NATIVE_VOICES)[number];

/** Recommended four-voice phone benchmark for Amy receptionist A/B (same prompt/flow/model/VAD). */
export const OUTBOUND_REALTIME_VOICE_BENCHMARK: readonly OpenAiRealtimeNativeVoice[] = [
  "marin",
  "coral",
  "shimmer",
  "cedar",
];

const VOICE_SET = new Set<string>(OPENAI_REALTIME_NATIVE_VOICES);

export function isOpenAiRealtimeNativeVoice(value: string): value is OpenAiRealtimeNativeVoice {
  return VOICE_SET.has(value.trim().toLowerCase());
}

/** Lowercase + validate; throws on unknown voice. */
export function normalizeRealtimeNativeVoice(
  raw: string,
  label = "realtimeVoice",
): OpenAiRealtimeNativeVoice {
  const voice = raw.trim().toLowerCase();
  if (!voice) {
    throw new Error(`${label} is required`);
  }
  if (!isOpenAiRealtimeNativeVoice(voice)) {
    throw new Error(
      `Invalid ${label}: "${raw}". Allowed: ${OPENAI_REALTIME_NATIVE_VOICES.join(", ")}`,
    );
  }
  return voice;
}

/** Parse comma-separated voice list (env/CLI); validates each entry. */
export function parseRealtimeNativeVoiceList(
  raw: string,
  label = "voices",
): OpenAiRealtimeNativeVoice[] {
  const parts = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!parts.length) {
    throw new Error(`${label} must include at least one voice`);
  }
  return parts.map((part, index) => normalizeRealtimeNativeVoice(part, `${label}[${index}]`));
}
