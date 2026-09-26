import { MctbSetupRecoveryView } from "@/components/mctb/setup/setup-recovery-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupRecoveryPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupRecoveryPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupRecoveryPage />;
  }
  return <MctbSetupRecoveryView />;
}
