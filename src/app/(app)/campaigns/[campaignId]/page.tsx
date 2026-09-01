import { CampaignDetailView } from "@/components/campaigns/campaign-detail-view";
import { CampaignResultsView } from "@/components/campaigns/broadcast/campaign-results";
import { buildCampaignTimeline } from "@/lib/campaigns/campaign-detail-helpers";
import { listBroadcastRecipients } from "@/lib/mass-texting/broadcast/analytics";
import { isBroadcastCampaign } from "@/lib/mass-texting/broadcast/service";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { estimateSmsSegments } from "@/lib/utils";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadAuditLogs, loadCampaignById } from "@/lib/workspace-data";
import { notFound } from "next/navigation";

type AuditLogRow = Awaited<ReturnType<typeof loadAuditLogs>>[number];

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

  const auditLogs = await loadAuditLogs(workspaceId);
  const segments = estimateSmsSegments(campaign.body);
  const timeline = buildCampaignTimeline(campaign);
  const activity = auditLogs.filter(
    (log: AuditLogRow) =>
      log.detail?.toLowerCase().includes(campaign.name.toLowerCase()) ||
      log.event.toLowerCase().includes("campaign"),
  );

  const statusNorm = campaign.status.toLowerCase();
  const showResultsView =
    statusNorm === "completed" ||
    statusNorm === "sending" ||
    statusNorm === "sent" ||
    statusNorm === "failed";

  if (showResultsView) {
    const recipients =
      isBroadcastCampaign(campaign.configJson)
        ? await listBroadcastRecipients(workspaceId, campaignId)
        : [];
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
      activity={activity.map((log) => ({
        id: log.id,
        event: log.event,
        detail: log.detail,
        at: log.at,
      }))}
    />
  );
}
