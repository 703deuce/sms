import { createServiceClient } from "@/lib/db/client";
import { getCampaignDetail } from "@/lib/reputation/campaigns";
import { pct } from "@/lib/reporting/metrics";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type {
  ReviewCampaignReportPayload,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

function recipientName(r: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  if (r.full_name?.trim()) return r.full_name.trim();
  const parts = [r.first_name, r.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return "Recipient";
}

export async function buildReviewCampaignReport(params: {
  businessId: string;
  campaignId: string;
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<ReviewCampaignReportPayload> {
  if (!params.campaignId) throw new Error("campaignId is required for review_campaign reports");

  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, organization_id")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  const detail = await getCampaignDetail(params.campaignId, params.businessId, {
    recipientLimit: 40,
  });
  const campaign = detail.campaign as {
    id: string;
    name: string;
    status: string;
    channel: string;
    created_at: string;
    started_at?: string | null;
    completed_at?: string | null;
  };
  const metrics = detail.metrics;
  const attribution = detail.attribution;

  const { count: recipientsTotal } = await supabase
    .from("review_request_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.campaignId)
    .eq("business_id", params.businessId);

  const sentBase = metrics.sent || 0;
  const attributed = attribution.confirmed + attribution.likely;
  // Match campaign UI: reply / attributed rates are over sends, not all recipients.
  const rates = {
    deliveryRate: sentBase > 0 ? pct(metrics.delivered, sentBase) : null,
    clickRate: metrics.delivered > 0 ? pct(metrics.clicked, metrics.delivered) : null,
    replyRate: sentBase > 0 ? pct(metrics.replied, sentBase) : null,
    attributedReviewRate: sentBase > 0 ? pct(attributed, sentBase) : null,
  };

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    business,
    params.whiteLabel
  );

  return {
    reportType: "review_campaign",
    business: {
      id: business.id,
      name: business.name?.trim() || "Business",
    },
    parameters: {
      campaignId: campaign.id,
      campaignName: campaign.name || "Review campaign",
      status: campaign.status,
      channel: campaign.channel,
      createdAt: campaign.created_at,
      startedAt: campaign.started_at ?? null,
      completedAt: campaign.completed_at ?? null,
    },
    funnel: {
      recipientsTotal: recipientsTotal ?? 0,
      queued: metrics.queued + metrics.sending,
      sent: metrics.sent,
      delivered: metrics.delivered,
      clicked: metrics.clicked,
      failed: metrics.failed,
      optedOut: metrics.opted_out,
      replied: metrics.replied,
      sms: metrics.sms,
      email: metrics.email,
    },
    attribution,
    rates,
    activity: detail.activity.map((a) => ({
      at: a.at,
      type: a.type,
      label: a.label,
      meta: a.meta,
    })),
    recipients: detail.recipients.items.map((r) => ({
      name: recipientName(r),
      status: String(r.status),
      channel: r.latest_message?.channel ?? null,
      repliedAt: (r.replied_at as string | null) ?? null,
      reviewDetectedAt: (r.review_detected_at as string | null) ?? null,
    })),
    whiteLabel,
    generatedAt: new Date().toISOString(),
  };
}
