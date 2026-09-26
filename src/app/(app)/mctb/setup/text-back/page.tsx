import { MctbSetupTextBackView } from "@/components/mctb/setup/setup-text-back-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupTextBackPage } from "@/newui-transplant/connected/mctb/setup-pages";
export default async function MctbSetupTextBackPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupTextBackPage />;
  }
  return <MctbSetupTextBackView />;
}
