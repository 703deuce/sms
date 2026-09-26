import { MctbSetupPhoneView } from "@/components/mctb/setup/setup-phone-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupPhonePage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupPhonePage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupPhonePage />;
  }
  return <MctbSetupPhoneView />;
}
