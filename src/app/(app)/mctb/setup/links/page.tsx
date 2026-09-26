import { MctbSetupLinksView } from "@/components/mctb/setup/setup-links-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupLinksPage } from "@/newui-transplant/mirror/routes/mctb/setup/links/page";

export default function MctbSetupLinksPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupLinksPage />;
  }
  return <MctbSetupLinksView />;
}
