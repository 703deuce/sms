import { MctbSetupExclusionsView } from "@/components/mctb/setup/setup-exclusions-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupExclusionsPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupExclusionsPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupExclusionsPage />;
  }
  return <MctbSetupExclusionsView />;
}
