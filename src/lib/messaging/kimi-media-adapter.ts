/**
 * Data adapter: maps /api/media + mass-texting campaigns ↔ Kimi messaging-media mock types.
 * Reuses campaigns adapter for MMS broadcast send path.
 */
export {
  fetchCampaigns,
  duplicateCampaign,
  saveCampaignDraft,
  fetchLaunchReview,
  launchCampaign,
  previewAudience,
  loadAudiencePickerItems,
  loadDefaultSendingNumber,
  displayCampaignStatus,
  timingLabel,
  type CampaignListRow,
  type LaunchReviewData,
} from "@/lib/campaigns/kimi-campaigns-adapter";

export type MediaAsset = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
};

export async function fetchMediaLibrary(): Promise<MediaAsset[]> {
  const res = await fetch("/api/media");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load media");
  return (json.data || []).map((a: { id: string; name?: string; url: string; mimeType?: string; sizeBytes?: number }) => ({
    id: a.id,
    name: a.name || "Media",
    url: a.url,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
  }));
}
