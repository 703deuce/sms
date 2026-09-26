import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupPage } from "@/newui-transplant/mirror/routes/mctb/setup/page";
import { MctbSetupOverview } from "@/components/mctb/setup-overview";

export default function MctbSetupPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupPage />;
  }
  return <MctbSetupOverview />;
}
