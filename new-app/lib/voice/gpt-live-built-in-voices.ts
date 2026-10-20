/**
 * GPT-Live-1 built-in voices (OpenAI Live `BuiltInVoice` union, 22 voices).
 */
export const GPT_LIVE_BUILT_IN_VOICE_IDS = [
  "alloy",
  "ash",
  "ballad",
  "beacon",
  "bossa",
  "cedar",
  "cinder",
  "coral",
  "delta",
  "echo",
  "gleam",
  "marin",
  "meridian",
  "quartz",
  "ripple",
  "sage",
  "shimmer",
  "stone",
  "tempo",
  "verse",
  "vesper",
  "willow",
] as const;

export type GptLiveBuiltInVoiceId = (typeof GPT_LIVE_BUILT_IN_VOICE_IDS)[number];

const VOICE_SET = new Set<string>(GPT_LIVE_BUILT_IN_VOICE_IDS);

export function isGptLiveBuiltInVoice(value: string): value is GptLiveBuiltInVoiceId {
  return VOICE_SET.has(value.trim().toLowerCase());
}

function titleCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export const RECEPTIONIST_VOICE_OPTIONS = GPT_LIVE_BUILT_IN_VOICE_IDS.map((id) => ({
  id,
  name: titleCase(id),
  note: `GPT-Live-1 · ${id}`,
  recommended: id === "marin",
}));

const LEGACY_DEMO_TO_LIVE: Record<string, GptLiveBuiltInVoiceId> = {
  aria: "marin",
  theo: "cedar",
  june: "coral",
  malik: "verse",
  sofia: "sage",
};

export function normalizeGptLiveVoiceId(raw: string): GptLiveBuiltInVoiceId {
  const trimmed = raw.trim();
  if (!trimmed) return "marin";
  const lower = trimmed.toLowerCase();
  if (isGptLiveBuiltInVoice(lower)) return lower;
  const legacy = LEGACY_DEMO_TO_LIVE[lower];
  if (legacy) return legacy;
  return "marin";
}
