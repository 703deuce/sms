import { CampaignDetailView } from "@/components/campaigns/campaign-detail-view";
import { CampaignResultsView } from "@/components/campaigns/broadcast/campaign-results";
import { listBroadcastRecipients } from "@/lib/mass-texting/broadcast/analytics";
import { buildCampaignTimelineFromData } from "@/lib/campaigns/campaign-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { estimateSmsSegments } from "@/lib/utils";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { loadCampaignById } from "@/lib/workspace-data";
import { notFound } from "next/navigation";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Campaign" description="Campaign details" />
        <EmptyState
          title="No workspace selected"
          description="Select or create a workspace to view this campaign."
        />
      </div>
    );
  }

  const campaign = await loadCampaignById(workspaceId, campaignId);

  if (!campaign) {
    notFound();
  }

  const auditLogs = await getPrisma().campaignLaunchAudit.findMany({
    where: { workspaceId, campaignId },
    orderBy: { confirmedAt: "desc" },
    take: 20,
  });
  const segments = estimateSmsSegments(campaign.body);
  const timeline = await buildCampaignTimelineFromData(workspaceId, campaign);
  const activity = auditLogs.map((audit: (typeof auditLogs)[number]) => ({
    id: audit.id,
    event: audit.metadata &&
      typeof audit.metadata === "object" &&
      (audit.metadata as Record<string, unknown>).recurringTemplate
      ? "Recurring campaign activated"
      : audit.scheduledAt
        ? "Campaign scheduled"
        : "Campaign launched",
    detail: `${audit.finalRecipientCount.toLocaleString()} recipients · ${audit.estimatedSegments.toLocaleString()} credits`,
    at: audit.confirmedAt.toISOString(),
  }));

  const statusNorm = campaign.status.toLowerCase();
  const showResultsView =
    statusNorm === "completed" ||
    statusNorm === "sending" ||
    statusNorm === "sent" ||
    statusNorm === "failed";

  if (showResultsView) {
    const recipients = await listBroadcastRecipients(workspaceId, campaignId);
    return (
      <CampaignResultsView
        campaign={{
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          audience: campaign.audience,
          body: campaign.body,
          type: campaign.type,
          sent: campaign.sent,
          delivered: campaign.delivered,
          clicks: campaign.clicks,
          replies: campaign.replies,
          optOuts: campaign.optOuts,
          cost: campaign.cost,
          scheduledAt: campaign.scheduledAt,
          configJson: campaign.configJson,
        }}
        recipients={recipients.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          status: r.status,
          deliveredAt: r.deliveredAt,
          clickedAt: r.clickedAt,
          repliedAt: r.repliedAt,
          optedOutAt: r.optedOutAt,
        }))}
        timeline={timeline}
        segmentsPerMessage={segments.segments}
        cost={campaign.cost}
      />
    );
  }

  return (
    <CampaignDetailView
      campaign={campaign}
      campaignId={campaignId}
      timeline={timeline}
      activity={activity.map((log: (typeof activity)[number]) => ({
        id: log.id,
        event: log.event,
        detail: log.detail,
        at: log.at,
      }))}
    />
  );
}
