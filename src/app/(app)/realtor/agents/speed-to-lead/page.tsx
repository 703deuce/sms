import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function SpeedToLeadAgentPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const config = await loadRealtorProductConfig(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Speed-to-Lead" description="Outbound qualification and follow-up." />
      <Card className="p-4 space-y-2 text-sm">
        <p>Call immediately: {config.speedToLead.callImmediately ? "Yes" : "No"}</p>
        <p>Buyer qualification: {config.speedToLead.buyerQualification ? "Yes" : "No"}</p>
        <p>Seller qualification: {config.speedToLead.sellerQualification ? "Yes" : "No"}</p>
        <p>Qualified outcome: {config.speedToLead.qualifiedOutcome}</p>
        <p>Follow-up: {config.speedToLead.useRecommendedFollowUp ? "Recommended sequence" : "Custom"}</p>
      </Card>
      <Card className="p-4">
        <CardTitle className="mb-2">Lead sources</CardTitle>
        <p className="text-sm">{config.leadSources.join(", ") || "None connected yet"}</p>
      </Card>
    </div>
  );
}
