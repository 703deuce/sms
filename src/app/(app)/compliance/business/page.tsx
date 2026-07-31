import { BusinessProfileForm } from "@/components/compliance/business-profile-form";
import {
  requireWorkspaceContext,
  loadComplianceOverview,
} from "@/lib/workspace-data";

export default async function ComplianceBusinessPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const overview = await loadComplianceOverview(workspaceId);

  return (
    <BusinessProfileForm
      registration={overview.registration}
      customerProfile={overview.customerProfile}
    />
  );
}
