import { MctbSetupTestView } from "@/components/mctb/setup/setup-test-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupTestPage } from "@/newui-transplant/mirror/routes/mctb/setup/test/page";

export default function MctbSetupTestPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupTestPage />;
  }
  return <MctbSetupTestView />;
}
