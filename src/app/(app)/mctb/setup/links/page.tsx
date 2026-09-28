import { MctbSetupLinksView } from "@/components/mctb/setup/setup-links-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbSetupLinksPage() {
  if (isNewUiStage2Enabled()) {
    redirect(resolveMctbSetupIaRedirect(MCTB_ROUTES.setupLinks) ?? `${MCTB_ROUTES.textBack}?section=booking`);
  }
  return <MctbSetupLinksView />;
}
