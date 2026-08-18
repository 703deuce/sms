import "server-only";

import { getAudioAsset, resolveAudioUrlForAsset } from "./media-service";

export type PromptPlayback = {
  playUrl?: string;
  sayText?: string;
};

/** Resolve menu/prompt audio for Twilio TwiML (Play URL or Say text). */
export async function resolvePromptPlayback(
  workspaceId: string,
  config: Record<string, unknown>,
): Promise<PromptPlayback> {
  const assetId = String(config.audioAssetId ?? "").trim();
  if (assetId) {
    const url = await resolveAudioUrlForAsset(workspaceId, assetId);
    if (url) return { playUrl: url };
    const asset = await getAudioAsset(workspaceId, assetId);
    if (asset?.sourceText?.trim()) {
      if (
        asset.sourceType === "telnyx_tts_reference" ||
        asset.sourceType === "elevenlabs" ||
        asset.sourceType === "upload" ||
        asset.sourceType === "recording"
      ) {
        return { sayText: asset.sourceText.trim() };
      }
    }
  }

  const text = String(config.text ?? config.promptText ?? config.greeting ?? "").trim();
  if (text) return { sayText: text };

  return {};
}

export function promptToTwimlInner(playback: PromptPlayback): string {
  if (playback.playUrl) {
    return `<Play>${escapeXml(playback.playUrl)}</Play>`;
  }
  if (playback.sayText) {
    return `<Say>${escapeXml(playback.sayText)}</Say>`;
  }
  return "";
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
