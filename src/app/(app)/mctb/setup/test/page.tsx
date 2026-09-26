import { MctbSetupTestView } from "@/components/mctb/setup/setup-test-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupTestPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupTestPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupTestPage />;
  }
  return <MctbSetupTestView />;
}
