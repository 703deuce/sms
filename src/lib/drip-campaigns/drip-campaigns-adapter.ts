/**
 * Client adapter for drip campaign list/detail fetches.
 * Keeps API response normalization out of presentation components.
 */
import type { DripCampaignRecord, DripEnrollmentRecord } from "@/lib/drip-campaigns/types";

export async function fetchDripCampaigns(): Promise<DripCampaignRecord[]> {
  const res = await fetch("/api/drip-campaigns");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load drip campaigns");
  return (json.data || []) as DripCampaignRecord[];
}

export type DripCampaignDetailPayload = {
  campaign: DripCampaignRecord;
  recipients: DripEnrollmentRecord[];
  stats: {
    totalTriggered: number;
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    messagesSent: number;
    avgOpenRate: number;
    avgReplyRate: number;
    deliveryRate?: number;
    deliveredCount?: number;
    failedCount?: number;
  };
  chart: {
    labels: string[];
    sent: number[];
    replies: number[];
  };
  recentDeliveries?: Array<{ id: string; to: string; status: string; sentAt: string }>;
};

export async function fetchDripCampaignDetail(
  campaignId: string,
): Promise<DripCampaignDetailPayload> {
  const res = await fetch(`/api/drip-campaigns/${encodeURIComponent(campaignId)}/detail`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load drip campaign");
  return json.data as DripCampaignDetailPayload;
}
