/**
 * LiveKit Inference TTS A/B presets for Amy voice comparison.
 * Switch via VOICE_TTS_PRESET or explicit VOICE_TTS_PROVIDER / MODEL / VOICE env vars.
 */

export const VOICE_TTS_PRESET_IDS = [
  "baseline",
  "cartesia",
  "rime",
  "inworld2",
  "elevenlabs",
] as const;

export type VoiceTtsPresetId = (typeof VOICE_TTS_PRESET_IDS)[number];

export type VoiceTtsPreset = {
  id: VoiceTtsPresetId;
  label: string;
  provider: string;
  model: string;
  voice: string;
  language: string;
  notes: string;
};

/** Curated receptionist voices — professional American female, conversational. */
export const VOICE_TTS_PRESETS: Record<VoiceTtsPresetId, VoiceTtsPreset> = {
  baseline: {
    id: "baseline",
    label: "A — Inworld 1.5 Mini (current)",
    provider: "inference",
    model: "inworld/inworld-tts-1.5-mini",
    voice: "Ashley",
    language: "en",
    notes: "Control arm for naturalness/latency comparison.",
  },
  cartesia: {
    id: "cartesia",
    label: "B — Cartesia Sonic 3.5 (Jacqueline)",
    provider: "cartesia",
    model: "cartesia/sonic-3.5",
    voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    language: "en",
    notes: "Confident young American female — LiveKit Inference default library.",
  },
  rime: {
    id: "rime",
    label: "C — Rime Mist v3",
    provider: "rime",
    model: "rime/mistv3",
    voice: "laguna",
    language: "en",
    notes: "Conversational American female — override VOICE_TTS_VOICE to audition others.",
  },
  inworld2: {
    id: "inworld2",
    label: "D — Inworld TTS 2.0 (Ashley)",
    provider: "inworld",
    model: "inworld/inworld-tts-2",
    voice: "Ashley",
    language: "en",
    notes: "Same voice name, newer model — isolates model upgrade vs provider switch.",
  },
  elevenlabs: {
    id: "elevenlabs",
    label: "E — ElevenLabs Flash v2.5 (Jessica)",
    provider: "elevenlabs",
    model: "elevenlabs/eleven_flash_v2_5",
    voice: "cgSgspJ2msm6clMCkdW9",
    language: "en",
    notes: "Quality ceiling via LiveKit Inference — no separate ElevenLabs API key.",
  },
};

export function isVoiceTtsPresetId(value: unknown): value is VoiceTtsPresetId {
  return (
    typeof value === "string" &&
    (VOICE_TTS_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function resolveVoiceTtsPreset(id?: string | null): VoiceTtsPreset {
  if (isVoiceTtsPresetId(id)) return VOICE_TTS_PRESETS[id];
  return VOICE_TTS_PRESETS.baseline;
}
