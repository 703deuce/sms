import { MctbSetupRecoveryView } from "@/components/mctb/setup/setup-recovery-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/setup/recovery/page";

export default function MctbSetupRecoveryPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupRecoveryPage />;
  }
  return <MctbSetupRecoveryView />;
}
