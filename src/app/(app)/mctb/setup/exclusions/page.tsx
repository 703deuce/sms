import { MctbSetupExclusionsView } from "@/components/mctb/setup/setup-exclusions-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupExclusionsPage } from "@/newui-transplant/mirror/routes/mctb/setup/exclusions/page";

export default function MctbSetupExclusionsPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupExclusionsPage />;
  }
  return <MctbSetupExclusionsView />;
}
