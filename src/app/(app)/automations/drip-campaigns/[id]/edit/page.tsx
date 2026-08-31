import { DripCampaignWizard } from "@/components/drip-campaigns/drip-campaign-wizard";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getDripCampaign } from "@/lib/drip-campaigns/service";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditDripCampaignPage({ params }: Props) {
  const { id } = await params;
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) notFound();
  const initial = await getDripCampaign(workspaceId, id);
  if (!initial) notFound();
  return <DripCampaignWizard mode="edit" initial={initial} />;
}
