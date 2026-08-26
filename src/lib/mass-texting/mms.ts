/** Mass Texting MMS helpers — pictures attach as publicly fetchable URLs. */

export const MASS_TEXT_MMS_MAX_ATTACHMENTS = 3;
export const MASS_TEXT_MMS_MAX_BYTES = 1_500_000;
export const MASS_TEXT_MMS_ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export function normalizeMediaUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const urls: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    urls.push(url);
    if (urls.length >= MASS_TEXT_MMS_MAX_ATTACHMENTS) break;
  }
  return [...new Set(urls)];
}

export function mediaUrlsFromCampaignConfig(configJson: unknown): string[] {
  if (!configJson || typeof configJson !== "object") return [];
  return normalizeMediaUrls((configJson as Record<string, unknown>).mediaUrls);
}

export function mediaUrlsForSequenceStep(
  step: {
    step_key?: string;
    step_type?: string;
    config?: Record<string, unknown>;
  } | null | undefined,
  campaignConfig?: unknown,
  sequence?: Array<{ step_key: string; step_type: string }>,
): string[] {
  const stepUrls = normalizeMediaUrls(step?.config?.mediaUrls);
  if (stepUrls.length) return stepUrls;
  const campaignUrls = mediaUrlsFromCampaignConfig(campaignConfig);
  if (!campaignUrls.length) return [];
  if (!step) return campaignUrls;
  if (Array.isArray(sequence) && sequence.length > 0) {
    const firstSms = sequence.find((s) => s.step_type === "send_sms");
    if (firstSms && firstSms.step_key === step.step_key) return campaignUrls;
    return [];
  }
  return campaignUrls;
}

export function isPhoneCampaignChannel(channel: string | null | undefined): boolean {
  const value = String(channel || "").toLowerCase();
  return value === "sms" || value === "mms";
}

export function campaignChannelForMedia(mediaUrls: string[]): "sms" | "mms" {
  return mediaUrls.length ? "mms" : "sms";
}
