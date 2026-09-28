import { MctbSetupExclusionsView } from "@/components/mctb/setup/setup-exclusions-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbSetupExclusionsPage() {
  if (isNewUiStage2Enabled()) {
    redirect(
      resolveMctbSetupIaRedirect(MCTB_ROUTES.setupExclusions) ??
        `${MCTB_ROUTES.missedCallRecovery}?tab=exclusions`,
    );
  }
  return <MctbSetupExclusionsView />;
}
