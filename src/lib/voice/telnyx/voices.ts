/**
 * Telnyx AI assistant voices for picker + defaults.
 * Prefer Ultra (natural, low-latency) over browser TTS / Kokoro.
 */

export type TelnyxVoiceOption = {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
  tier: "ultra" | "natural_hd" | "natural";
  language: string;
  description: string;
};

/** Curated high-quality voices for the builder (always available offline). */
export const CURATED_TELNYX_VOICES: TelnyxVoiceOption[] = [
  {
    id: "Telnyx.Ultra.Clara",
    name: "Clara",
    gender: "female",
    tier: "ultra",
    language: "en-US",
    description: "Warm, clear Ultra — best default for reception",
  },
  {
    id: "Telnyx.Ultra.Callie",
    name: "Callie",
    gender: "female",
    tier: "ultra",
    language: "en",
    description: "Friendly Ultra voice",
  },
  {
    id: "Telnyx.Ultra.Asher",
    name: "Asher",
    gender: "male",
    tier: "ultra",
    language: "en",
    description: "Natural male Ultra voice",
  },
  {
    id: "Telnyx.NaturalHD.andromeda",
    name: "Andromeda",
    gender: "female",
    tier: "natural_hd",
    language: "en-US",
    description: "NaturalHD — polished multilingual",
  },
  {
    id: "Telnyx.NaturalHD.astra",
    name: "Astra",
    gender: "female",
    tier: "natural_hd",
    language: "en-US",
    description: "NaturalHD bright assistant tone",
  },
  {
    id: "Telnyx.NaturalHD.orion",
    name: "Orion",
    gender: "male",
    tier: "natural_hd",
    language: "en-US",
    description: "NaturalHD male",
  },
];

export const DEFAULT_AGENT_VOICE_ID = "Telnyx.Ultra.Clara";

export function isUltraVoice(voiceId: string) {
  return voiceId.startsWith("Telnyx.Ultra.");
}

export function voiceLabel(voiceId: string) {
  const hit = CURATED_TELNYX_VOICES.find((v) => v.id === voiceId);
  if (hit) return `${hit.name} (${hit.tier === "ultra" ? "Ultra" : "NaturalHD"})`;
  const parts = voiceId.split(".");
  return parts[parts.length - 1] || voiceId;
}
