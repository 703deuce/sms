import { BusinessSettingsConnected } from "@/features/settings/kimi/business/business-connected";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
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

  const body = (
    <BusinessSettingsConnected
      workspaceName={workspace?.name || ""}
      registration={registration}
      complianceReady={Boolean(brandOk && campaignOk && compliance.ready)}
      lastSynced={registration?.updatedAt?.toISOString() || null}
      hideChrome={isNewUiStage2Enabled()}
    />
  );

  if (isNewUiStage2Enabled()) {
    return body;
  }

  return <div className="kimi-surface kimi-settings-business">{body}</div>;
}
