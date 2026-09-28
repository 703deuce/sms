/**
 * Platform-wide pre-recorded ElevenLabs voicemail greeting.
 * Used when a workspace has not saved custom greeting audio (greetingUrl).
 * Same pattern as MCTB press-1 consent (`cmt3o8tyd1o5r0o4k3e4n5v2l`).
 */
export const DEFAULT_VOICEMAIL_GREETING_AUDIO_ASSET_ID = "cmt8pz72y1o096i6y3c24383j";

export function resolvePlatformVoicemailGreetingAssetId(): string {
  return (
    process.env.MCTB_PLATFORM_VOICEMAIL_GREETING_AUDIO_ASSET_ID?.trim() ||
    process.env.MCTB_DEFAULT_VOICEMAIL_GREETING_AUDIO_ASSET_ID?.trim() ||
    DEFAULT_VOICEMAIL_GREETING_AUDIO_ASSET_ID
  );
}

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    ""
  );
}

/** Carrier-facing HTTPS playback URL for the platform default voicemail greeting. */
export function resolvePlatformVoicemailGreetingPlayUrl(): string {
  const assetId = resolvePlatformVoicemailGreetingAssetId();
  const base = appBaseUrl();
  const path = clientPlatformVoicemailGreetingPreviewPath(assetId);
  return base ? `${base}${path}` : path;
}

/** Relative path — safe for browser preview on the app origin. */
export function clientPlatformVoicemailGreetingPreviewPath(assetId?: string): string {
  const id = assetId?.trim() || resolvePlatformVoicemailGreetingAssetId();
  return `/api/public/smart-routing-audio/${id}`;
}
