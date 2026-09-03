import { DripCampaignWizard } from "@/components/drip-campaigns/drip-campaign-wizard";
import { DripSectionShell } from "@/components/drip-campaigns/drip-section-shell";

export default function NewDripCampaignPage() {
  return (
    <DripSectionShell>
      <DripCampaignWizard mode="create" />
    </DripSectionShell>
  );
}
