import { BrandingSettingsForm } from "@/components/settings/branding-settings-form";
import { loadWorkspace, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function SettingsBrandingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const workspace = await loadWorkspace(workspaceId);

  return <BrandingSettingsForm workspaceName={workspace?.name || ""} />;
}
