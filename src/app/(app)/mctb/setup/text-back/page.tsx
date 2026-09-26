import { MctbSetupTextBackView } from "@/components/mctb/setup/setup-text-back-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupTextBackPage } from "@/newui-transplant/mirror/routes/mctb/setup/text-back/page";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function MctbSetupTextBackPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupTextBackPage />;
  }
  return <MctbSetupTextBackView />;
}
