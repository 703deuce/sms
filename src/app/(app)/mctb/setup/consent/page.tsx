import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupConsentPage } from "@/newui-transplant/connected/mctb/setup-pages";
import { MctbSetupConsentView } from "@/components/mctb/setup/setup-consent-view";

export default async function MctbSetupConsentPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupConsentPage />;
  }
  return <MctbSetupConsentView />;
}
