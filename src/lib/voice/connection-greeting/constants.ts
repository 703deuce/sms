/**
 * Prerecorded connection greeting — generate once, mix once, reuse on calls.
 * Speech via ElevenLabs TTS; bed via Eleven Music; mix via FFmpeg.
 */

export const CONNECTION_GREETING_TEXT =
  "Thank you for calling. One moment, please, while I connect you with our receptionist.";

export const CONNECTION_GREETING_VOICE_ID = "kdmDKE6EkgrWrrykO9Qt";
export const CONNECTION_GREETING_VOICE_NAME = "Alexandra";
export const CONNECTION_GREETING_TTS_MODEL = "eleven_v3";

export const CONNECTION_GREETING_TTS_SETTINGS = {
  stability: 0.45,
  similarityBoost: 0.78,
  style: 0.15,
  useSpeakerBoost: true,
} as const;

export const CONNECTION_GREETING_MUSIC_PROMPT =
  "Short, subtle professional telephone connection music. Warm modern corporate ambience, soft electric piano and gentle ambient pad, calm and welcoming, minimal melody, no drums, no percussion hits, no vocals, no singing, no sound effects, no dramatic build, suitable underneath a business receptionist greeting.";

export const CONNECTION_GREETING_MUSIC_LENGTH_MS = 6000;

/** Public URL path for telephone-ready playback (hosted on APP_URL). */
export const CONNECTION_GREETING_PUBLIC_DIR = "/connection-greeting";
export const CONNECTION_GREETING_PHONE_MP3 =
  `${CONNECTION_GREETING_PUBLIC_DIR}/transovo-connection-greeting-phone.mp3`;
export const CONNECTION_GREETING_PHONE_WAV =
  `${CONNECTION_GREETING_PUBLIC_DIR}/transovo-connection-greeting-phone.wav`;

export type ConnectionGreetingMode = "off" | "transovo_default";

export function connectionGreetingAudioUrl(appUrl: string): string {
  const base = String(appUrl || "").replace(/\/$/, "");
  return `${base}${CONNECTION_GREETING_PHONE_MP3}`;
}
