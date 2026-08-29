import { DripCampaignDetail } from "@/components/drip-campaigns/drip-campaign-detail";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadDripCampaignDetail } from "@/lib/drip-campaigns/engine";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DripCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) notFound();

  const data = await loadDripCampaignDetail(workspaceId, id);
  if (!data) notFound();

  return (
    <DripCampaignDetail
      campaign={data.campaign}
      recipients={data.recipients}
      stats={data.stats}
      chart={data.chart}
      recentDeliveries={data.recentDeliveries}
    />
  );
}
