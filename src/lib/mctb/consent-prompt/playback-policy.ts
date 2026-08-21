/** Shared consent playback policy (no server-only — safe for tests). */

export function requiresPublishedConsentAudio(config: Record<string, unknown>): boolean {
  return Boolean(
    config.promptScriptHash || config.audioAssetId || config.promptAssetId,
  );
}

export type ConsentPlaybackResult = {
  playUrl?: string;
  sayText?: string;
  failClosed?: boolean;
};

/**
 * When a published audio asset is configured but unreachable, fail closed —
 * callers must not consent via TTS fallback.
 */
export function applyConsentPlaybackFailClosed(
  config: Record<string, unknown>,
  playback: { playUrl?: string; sayText?: string },
): ConsentPlaybackResult {
  const assetId = String(config.audioAssetId ?? config.promptAssetId ?? "").trim();
  if (requiresPublishedConsentAudio(config) && assetId && !playback.playUrl) {
    return { failClosed: true };
  }
  return playback;
}
