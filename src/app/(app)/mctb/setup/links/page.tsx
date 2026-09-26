import { MctbSetupLinksView } from "@/components/mctb/setup/setup-links-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupLinksPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupLinksPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupLinksPage />;
  }
  return <MctbSetupLinksView />;
}
