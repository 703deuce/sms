import { MctbSetupTextBackView } from "@/components/mctb/setup/setup-text-back-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default async function MctbSetupTextBackPage() {
  if (isNewUiStage2Enabled()) {
    redirect(resolveMctbSetupIaRedirect(MCTB_ROUTES.setupTextBack) ?? MCTB_ROUTES.textBack);
  }
  return <MctbSetupTextBackView />;
}
