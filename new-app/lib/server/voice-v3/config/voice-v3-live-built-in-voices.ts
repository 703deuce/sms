import type { BuiltInVoice } from "openai/resources/live/live";

/**
 * GPT-Live built-in voices from openai@7.17.x (`BuiltInVoice` union).
 * Authority: node_modules/openai/resources/live/live.d.ts — not legacy Telnyx/ElevenLabs catalogs.
 */
export const VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS: readonly BuiltInVoice[] = [
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
];

export type VoiceV3LiveBuiltInVoiceId = BuiltInVoice;

const VOICE_V3_SET = new Set<string>(VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS);

export function isVoiceV3LiveBuiltInVoice(value: string): value is VoiceV3LiveBuiltInVoiceId {
  return VOICE_V3_SET.has(value.trim().toLowerCase());
}

function titleCaseVoiceId(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Wizard Step 6 presentation rows (GPT-Live only). */
export const VOICE_V3_WIZARD_LIVE_VOICES = VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS.map(
  (id) => ({
    id,
    label: titleCaseVoiceId(id),
    badge: id === "marin" ? "Recommended" : "GPT-Live",
    description: `OpenAI GPT-Live voice · ${id}`,
    gender: "neutral" as const,
    recommendedSpeed: 1,
  }),
);

/** Legacy ElevenLabs catalog ids from early wizard builds → closest GPT-Live default. */
const LEGACY_WIZARD_VOICE_TO_V3_LIVE: Record<string, VoiceV3LiveBuiltInVoiceId> = {
  "ava-warm-us": "marin",
  "allie-ultra": "sage",
  "maya-energetic-us": "shimmer",
  "celeste-naturalhd": "cedar",
  "orion-naturalhd": "verse",
  jessica: "marin",
};

export function tryNormalizeVoiceV3LiveBuiltInVoice(
  raw: string,
): VoiceV3LiveBuiltInVoiceId | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (isVoiceV3LiveBuiltInVoice(lower)) return lower;
  if (trimmed.startsWith("el:")) {
    return LEGACY_WIZARD_VOICE_TO_V3_LIVE[trimmed] ?? "marin";
  }
  const legacy =
    LEGACY_WIZARD_VOICE_TO_V3_LIVE[trimmed] || LEGACY_WIZARD_VOICE_TO_V3_LIVE[lower];
  if (legacy) return legacy;
  return null;
}

export function normalizeVoiceV3LiveBuiltInVoice(
  raw: string,
  label = "voiceId",
): VoiceV3LiveBuiltInVoiceId {
  const normalized = tryNormalizeVoiceV3LiveBuiltInVoice(raw);
  if (!normalized) {
    throw new Error(
      `Invalid ${label}: "${raw}". Allowed GPT-Live voices: ${VOICE_V3_OPENAI_LIVE_BUILT_IN_VOICE_IDS.join(", ")}`,
    );
  }
  return normalized;
}
