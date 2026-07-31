import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import {
  loadComplianceOverview,
  loadRegistration,
  loadWorkspace,
  requireWorkspaceContext,
} from "@/lib/workspace-data";

export default async function SettingsBusinessPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [workspace, registration, compliance] = await Promise.all([
    loadWorkspace(workspaceId),
    loadRegistration(workspaceId),
    loadComplianceOverview(workspaceId),
  ]);

  const brandOk = (registration?.brandStatus || "").toLowerCase() === "approved";
  const campaignOk = (registration?.campaignStatus || "").toLowerCase() === "approved";

  return (
    <BusinessSettingsForm
      workspaceName={workspace?.name || ""}
      registration={registration}
      complianceReady={Boolean(brandOk && campaignOk && compliance.ready)}
      lastSynced={registration?.updatedAt?.toISOString() || null}
    />
  );
}
