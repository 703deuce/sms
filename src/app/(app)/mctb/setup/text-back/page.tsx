import { MctbSetupTextBackView } from "@/components/mctb/setup/setup-text-back-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { NewUiMctbSetupTextBackPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default async function MctbSetupTextBackPage() {
  if (isNewUiStage2Enabled()) {
    const { session } = await requireWorkspaceContext();
    return <NewUiMctbSetupTextBackPage workspaceName={session.name ?? "Workspace"} />;
  }
  return <MctbSetupTextBackView />;
}
