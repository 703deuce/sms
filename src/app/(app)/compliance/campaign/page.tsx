import { CampaignRegistrationForm } from "@/components/compliance/campaign-registration-form";
import {
  requireWorkspaceContext,
  loadComplianceOverview,
} from "@/lib/workspace-data";

export default async function ComplianceCampaignPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const overview = await loadComplianceOverview(workspaceId);

  return (
    <CampaignRegistrationForm
      registration={overview.registration}
      campaignStatus={overview.campaign}
    />
  );
}
