/**
 * Curated ElevenLabs voices for receptionist / appointment agents.
 * Prefer these over arbitrary account voice order in the picker.
 *
 * Official conversational-agent guidance + live-agent testing order:
 * 1. Alexandra — friendly receptionist baseline
 * 2. Jessica Anne Bogart — warmer / more empathetic
 * 3. Eryn — casual small-business tone
 *
 * Recommended starting tuning (ElevenLabs guidance):
 * stability ~0.45, similarity ~0.75, speed 1.0
 */

export const ELEVENLABS_RECEPTIONIST_TUNING = {
  stability: 0.45,
  similarityBoost: 0.75,
  speed: 1.0,
} as const;

export const ELEVENLABS_RECEPTIONIST_VOICES = [
  {
    voiceId: "kdmDKE6EkgrWrrykO9Qt",
    displayName: "Alexandra",
    style: "Super realistic young female — likes to chat; best overall receptionist candidate",
    testOrder: 1,
  },
  {
    voiceId: "g6xIsTj2HwM6VR4iXFCw",
    displayName: "Jessica Anne Bogart",
    style: "Empathetic and expressive — strong for medical, dental, or stressed callers",
    testOrder: 2,
  },
  {
    voiceId: "dj3G1R1ilKoFKhBnWOzG",
    displayName: "Eryn",
    style: "Friendly and relatable — natural small-business employee tone",
    testOrder: 3,
  },
] as const;

export type ReceptionistVoiceId =
  (typeof ELEVENLABS_RECEPTIONIST_VOICES)[number]["voiceId"];

export function isReceptionistVoiceId(voiceId: string): boolean {
  return ELEVENLABS_RECEPTIONIST_VOICES.some((v) => v.voiceId === voiceId);
}

export function getReceptionistVoice(voiceId: string) {
  return ELEVENLABS_RECEPTIONIST_VOICES.find((v) => v.voiceId === voiceId) || null;
}

/**
 * Put curated receptionist voices first, then the rest of the account list.
 * Missing curated IDs are still listed with name/style from this file so the
 * picker can offer them even if they aren't in the first page of /v1/voices.
 */
export function prioritizeReceptionistVoices<
  T extends { voice_id: string; name: string; description?: string | null },
>(voices: T[]): T[] {
  const byId = new Map(voices.map((v) => [v.voice_id, v]));
  const prioritized: T[] = [];
  for (const curated of ELEVENLABS_RECEPTIONIST_VOICES) {
    const existing = byId.get(curated.voiceId);
    if (existing) {
      prioritized.push({
        ...existing,
        name: existing.name || curated.displayName,
        description: existing.description || curated.style,
      });
      byId.delete(curated.voiceId);
    }
  }
  for (const v of voices) {
    if (byId.has(v.voice_id)) prioritized.push(v);
  }
  return prioritized;
}
