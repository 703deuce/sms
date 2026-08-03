/**
 * Controlled Telnyx vs ElevenLabs receptionist A/B shortlist.
 *
 * Keep ElevenLabs code paths intact — this only defines candidates and the
 * shared call script. Switch production via the A/B switcher (never silent remap).
 *
 * Source for Ultra UUIDs: Telnyx Available Voices catalog
 * https://developers.telnyx.com/docs/tts-stt/tts-available-voices
 * Retrieved 2026-08-03.
 */

export const VOICE_AB_SCRIPT_LINES = [
  "Thank you for calling Transovo. I can take a message or help you schedule an appointment. How may I help you today?",
  "Okay, I can help with that. May I have your first and last name?",
  "Let me confirm your phone number: five seven one, five five five, zero one two three.",
  "I have Tuesday at ten thirty in the morning or Thursday at two fifteen in the afternoon. Which works better for you?",
  "I'm sorry you're dealing with that. Let me collect a few details so I can get the correct person to help you.",
] as const;

export const VOICE_AB_SCORE_FIELDS = [
  "timeToFirstAudio",
  "averageTurnLatency",
  "pronunciationNamesNumbersTimes",
  "interruptionBehavior",
  "perceivedNaturalness",
  "soundsLikeTtsReader",
  "naturalAfterTwoMinutes",
] as const;

export type VoiceAbCandidate = {
  id: string;
  rank: number;
  displayName: string;
  role: string;
  /** Catalog id saved on the agent (el:… or curated id / provider string). */
  voiceRef: string;
  /** Exact Telnyx voice_settings.voice (or ElevenLabs provider string). */
  providerVoiceId: string;
  provider: "telnyx" | "elevenlabs";
  model: "NaturalHD" | "Ultra" | "eleven_flash_v2_5";
  optional?: boolean;
  /** Ultra only: run both expressive off then on. */
  expressiveVariants?: boolean;
  /** Catalog notes — e.g. Mia missing from live catalog. */
  note?: string;
  /** Recommended starting expressive for first live switch. */
  defaultExpressiveMode?: boolean;
  elevenLabsTuning?: {
    stability: number;
    similarityBoost: number;
    speed: number;
  };
};

/**
 * Mia ("Agent") is described in Telnyx-affiliated marketing (TTS Library) but
 * was NOT present in the live Telnyx Available Voices catalog on 2026-08-03.
 * Closest English female support Ultra: Maia - Agile Support.
 */
export const MIA_CATALOG_STATUS = {
  requestedName: "Mia - Agent",
  foundInTelnyxCatalog: false as const,
  substitute: {
    displayName: "Maia",
    style: "Agile Support",
    providerVoiceId: "Telnyx.Ultra.5a033900-2ed6-4fd4-a257-707f2688e713",
  },
  retrievedAt: "2026-08-03",
  source: "https://developers.telnyx.com/docs/tts-stt/tts-available-voices",
} as const;

export const VOICE_AB_CANDIDATES: VoiceAbCandidate[] = [
  {
    id: "astra-naturalhd",
    rank: 1,
    displayName: "Astra",
    role: "NaturalHD flagship — polished receptionist baseline",
    voiceRef: "Telnyx.NaturalHD.astra",
    providerVoiceId: "Telnyx.NaturalHD.astra",
    provider: "telnyx",
    model: "NaturalHD",
    defaultExpressiveMode: false,
  },
  {
    id: "allie-ultra",
    rank: 2,
    displayName: "Allie",
    role: "Natural Conversationalist — least synthetic Ultra candidate",
    voiceRef: "Telnyx.Ultra.2747b6cf-fa34-460c-97db-267566918881",
    providerVoiceId: "Telnyx.Ultra.2747b6cf-fa34-460c-97db-267566918881",
    provider: "telnyx",
    model: "Ultra",
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "maia-ultra",
    rank: 3,
    displayName: "Maia",
    role: "Agile Support — stand-in for missing Mia Agent",
    voiceRef: MIA_CATALOG_STATUS.substitute.providerVoiceId,
    providerVoiceId: MIA_CATALOG_STATUS.substitute.providerVoiceId,
    provider: "telnyx",
    model: "Ultra",
    expressiveVariants: true,
    defaultExpressiveMode: false,
    note: `Mia - Agent not in Telnyx catalog (${MIA_CATALOG_STATUS.retrievedAt}); using Maia - Agile Support UUID`,
  },
  {
    id: "callie-ultra",
    rank: 4,
    displayName: "Callie",
    role: "Encourager — warmer healthcare / scheduling tone",
    voiceRef: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    providerVoiceId: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    provider: "telnyx",
    model: "Ultra",
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "alexandra-flash",
    rank: 5,
    displayName: "Alexandra",
    role: "ElevenLabs Flash v2.5 — human baseline",
    voiceRef: "el:eleven_flash_v2_5:kdmDKE6EkgrWrrykO9Qt",
    providerVoiceId: "ElevenLabs.eleven_flash_v2_5.kdmDKE6EkgrWrrykO9Qt",
    provider: "elevenlabs",
    model: "eleven_flash_v2_5",
    defaultExpressiveMode: false,
    elevenLabsTuning: {
      stability: 0.45,
      similarityBoost: 0.75,
      speed: 1.0,
    },
  },
  {
    id: "cindy-ultra",
    rank: 6,
    displayName: "Cindy",
    role: "Receptionist label — optional conventional front desk",
    voiceRef: "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    providerVoiceId: "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    provider: "telnyx",
    model: "Ultra",
    optional: true,
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "howard-ultra",
    rank: 7,
    displayName: "Howard",
    role: "Approachable Man — optional male transactional",
    voiceRef: "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82",
    providerVoiceId: "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82",
    provider: "telnyx",
    model: "Ultra",
    optional: true,
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "jasper-ultra",
    rank: 8,
    displayName: "Jasper",
    role: "Service Specialist — optional male sales-adjacent",
    voiceRef: "Telnyx.Ultra.3faa81ae-d3d8-4ab1-9e44-e50e46d33c30",
    providerVoiceId: "Telnyx.Ultra.3faa81ae-d3d8-4ab1-9e44-e50e46d33c30",
    provider: "telnyx",
    model: "Ultra",
    optional: true,
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
];

export function getVoiceAbCandidate(idOrRef: string): VoiceAbCandidate | null {
  const raw = String(idOrRef || "").trim();
  return (
    VOICE_AB_CANDIDATES.find(
      (c) =>
        c.id === raw ||
        c.voiceRef === raw ||
        c.providerVoiceId === raw ||
        c.displayName.toLowerCase() === raw.toLowerCase(),
    ) || null
  );
}

export function primaryVoiceAbCandidates() {
  return VOICE_AB_CANDIDATES.filter((c) => !c.optional);
}

export function emptyVoiceAbScorecard() {
  return VOICE_AB_CANDIDATES.map((c) => ({
    candidateId: c.id,
    displayName: c.displayName,
    providerVoiceId: c.providerVoiceId,
    expressiveMode: c.model === "Ultra" ? false : null,
    scores: Object.fromEntries(VOICE_AB_SCORE_FIELDS.map((f) => [f, null])),
    notes: "",
  }));
}
