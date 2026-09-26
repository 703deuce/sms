import { MctbSetupConsentView } from "@/components/mctb/setup/setup-consent-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { NewUiMctbSetupConsentPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default async function MctbSetupConsentPage() {
  if (isNewUiStage2Enabled()) {
    const { session } = await requireWorkspaceContext();
    return <NewUiMctbSetupConsentPage workspaceName={session.name ?? "Workspace"} />;
  }
  return <MctbSetupConsentView />;
}
