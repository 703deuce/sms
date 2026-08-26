import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { resolvePlatformVoicemailGreetingPlayUrl } from "@/lib/phone/voicemail-greeting-defaults";

/** Carrier-facing HTTPS URL for ElevenLabs / uploaded greeting audio. */
export function absolutizePublicMediaUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = getAppBaseUrl().replace(/\/$/, "");
  if (!base || base.includes("localhost")) return null;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export function smartRoutingAssetIdFromUrl(url: string): string | null {
  const match = url.match(/smart-routing-audio\/([a-z0-9]+)/i);
  return match?.[1] ?? null;
}

export async function resolveVoicemailGreetingPlayback(
  workspaceId: string,
  box: { greetingUrl: string | null; greetingText: string | null },
): Promise<{ playUrl: string | null; sayText: string | null }> {
  const raw = box.greetingUrl?.trim();
  if (raw) {
    const assetId = smartRoutingAssetIdFromUrl(raw);
    if (assetId) {
      const { resolveAudioUrlForAsset } = await import("@/lib/smart-routing/media-service");
      const fromAsset = await resolveAudioUrlForAsset(workspaceId, assetId);
      if (fromAsset) return { playUrl: fromAsset, sayText: null };
    }
    const absolute = absolutizePublicMediaUrl(raw);
    if (absolute) return { playUrl: absolute, sayText: null };
  }

  const defaultPlayUrl = resolvePlatformVoicemailGreetingPlayUrl();
  if (defaultPlayUrl.startsWith("http")) {
    return { playUrl: defaultPlayUrl, sayText: null };
  }

  const text = box.greetingText?.trim();
  return { playUrl: null, sayText: text || null };
}

export function normalizeVoicemailGreetingUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return absolutizePublicMediaUrl(trimmed) ?? trimmed;
}
