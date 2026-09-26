import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupPhonePage } from "@/newui-transplant/mirror/routes/mctb/setup/phone/page";
import { MctbSetupPhoneView } from "@/components/mctb/setup/setup-phone-view";

export default function MctbSetupPhonePage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupPhonePage />;
  }
  return <MctbSetupPhoneView />;
}
