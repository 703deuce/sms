import { MctbSetupTestView } from "@/components/mctb/setup/setup-test-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbSetupTestPage() {
  if (isNewUiStage2Enabled()) {
    redirect(resolveMctbSetupIaRedirect(MCTB_ROUTES.setupTest) ?? `${MCTB_ROUTES.phone}?test=1`);
  }
  return <MctbSetupTestView />;
}
