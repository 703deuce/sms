/** Resolve ElevenLabs key across Coolify / Telnyx / LiveKit plugin env names. */
export function resolveElevenLabsApiKey(): string | undefined {
  return (
    process.env.ELEVEN_API_KEY?.trim() ||
    process.env.ELEVENLABS_API_KEY?.trim() ||
    process.env.ELEVENLABS_KEY?.trim() ||
    undefined
  );
}

/** Normalize voice-runtime env aliases before pipeline plugins read process.env. */
export function applyVoiceRuntimeEnvAliases(): void {
  const elevenKey = resolveElevenLabsApiKey();
  if (elevenKey) {
    if (!process.env.ELEVEN_API_KEY?.trim()) process.env.ELEVEN_API_KEY = elevenKey;
    if (!process.env.ELEVENLABS_API_KEY?.trim()) process.env.ELEVENLABS_API_KEY = elevenKey;
    if (!process.env.ELEVENLABS_KEY?.trim()) process.env.ELEVENLABS_KEY = elevenKey;
  }

  if (!process.env.GEMINI_API_KEY?.trim() && process.env.GOOGLE_GEMINI_API_KEY?.trim()) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY.trim();
  }
}
