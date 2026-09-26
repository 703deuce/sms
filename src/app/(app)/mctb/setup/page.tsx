import { MctbSetupOverview } from "@/components/mctb/setup-overview";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupOverviewPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupOverviewPage />;
  }
  return <MctbSetupOverview />;
}
