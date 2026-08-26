/** Campaign media helpers — no DB imports (safe for pre-send review). */

export function getCampaignMediaUrls(configJson: unknown): string[] {
  const config =
    configJson && typeof configJson === "object"
      ? (configJson as Record<string, unknown>)
      : {};
  const urls = config.mediaUrls;
  if (!Array.isArray(urls)) return [];
  return urls.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

export function isCampaignMms(configJson: unknown): boolean {
  return getCampaignMediaUrls(configJson).length > 0;
}

export function campaignTypeImpliesMms(campaignType: string | null | undefined): boolean {
  return String(campaignType || "")
    .toLowerCase()
    .includes("mms");
}

export function validateCampaignMediaConfig(input: {
  configJson: unknown;
  campaignType?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const hasMedia = isCampaignMms(input.configJson);
  const impliesMms = campaignTypeImpliesMms(input.campaignType);
  if (impliesMms && !hasMedia) {
    return {
      ok: false,
      error: "MMS campaigns require at least one image attachment in media library",
    };
  }
  return { ok: true };
}
