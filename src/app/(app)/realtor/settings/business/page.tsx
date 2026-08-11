import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorBusinessSettingsPage() {
  const { workspaceId, config } = await requireRealtorOnboardingComplete();
  void workspaceId;
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Business Settings" />
      <Card className="p-4 text-sm">
        <CardTitle className="mb-3">Profile</CardTitle>
        <p>Team: {config.business.teamName || "—"}</p>
        <p>Brokerage: {config.business.brokerage || "—"}</p>
        <p>Areas: {config.business.serviceAreas?.join(", ") || "—"}</p>
        <p>Hours: {config.business.businessHours || "—"}</p>
      </Card>
    </div>
  );
}
