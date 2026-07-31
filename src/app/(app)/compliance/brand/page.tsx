import { BrandRegistrationPanel } from "@/components/compliance/brand-registration-panel";
import {
  requireWorkspaceContext,
  loadComplianceOverview,
} from "@/lib/workspace-data";

export default async function ComplianceBrandPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const overview = await loadComplianceOverview(workspaceId);

  return (
    <BrandRegistrationPanel
      registration={overview.registration}
      brandStatus={overview.brand}
    />
  );
}
