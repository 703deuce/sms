import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupConsentPage } from "@/newui-transplant/mirror/routes/mctb/setup/consent/page";
import { MctbSetupConsentView } from "@/components/mctb/setup/setup-consent-view";

export default async function MctbSetupConsentPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupConsentPage />;
  }
  return <MctbSetupConsentView />;
}
