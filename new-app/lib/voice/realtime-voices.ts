/** OpenAI Realtime / GPT-Live built-in voices (Voice V3 golden era). */
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

const VOICE_SET = new Set<string>(OPENAI_REALTIME_NATIVE_VOICES);

export function isOpenAiRealtimeNativeVoice(value: string): value is OpenAiRealtimeNativeVoice {
  return VOICE_SET.has(value.trim().toLowerCase());
}

/** Blueprint demo ids → OpenAI realtime voice. */
const LEGACY_DEMO_TO_REALTIME: Record<string, OpenAiRealtimeNativeVoice> = {
  aria: "marin",
  theo: "cedar",
  june: "coral",
  malik: "verse",
  sofia: "sage",
  "sofía": "sage",
};

export function normalizeReceptionistVoiceId(raw: string): OpenAiRealtimeNativeVoice {
  const trimmed = raw.trim();
  if (!trimmed) return "marin";
  const lower = trimmed.toLowerCase();
  if (isOpenAiRealtimeNativeVoice(lower)) return lower;
  const legacy = LEGACY_DEMO_TO_REALTIME[lower] || LEGACY_DEMO_TO_REALTIME[trimmed];
  if (legacy) return legacy;
  return "marin";
}

export const RECEPTIONIST_VOICE_OPTIONS: {
  id: OpenAiRealtimeNativeVoice;
  name: string;
  note: string;
  recommended?: boolean;
}[] = [
  { id: "marin", name: "Marin", note: "Warm, natural, professional · OpenAI Live", recommended: true },
  { id: "coral", name: "Coral", note: "Friendly and upbeat · OpenAI Live" },
  { id: "shimmer", name: "Shimmer", note: "Bright and energetic · OpenAI Live" },
  { id: "cedar", name: "Cedar", note: "Clear and confident · OpenAI Live" },
  { id: "sage", name: "Sage", note: "Calm and steady · OpenAI Live" },
  { id: "verse", name: "Verse", note: "Warm and approachable · OpenAI Live" },
  { id: "alloy", name: "Alloy", note: "Balanced and neutral · OpenAI Live" },
  { id: "echo", name: "Echo", note: "Smooth and clear · OpenAI Live" },
  { id: "ash", name: "Ash", note: "Soft and conversational · OpenAI Live" },
  { id: "ballad", name: "Ballad", note: "Expressive · OpenAI Live" },
];
