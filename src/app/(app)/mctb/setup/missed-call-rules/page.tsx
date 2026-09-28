import { MctbSetupMissedCallRulesView } from "@/components/mctb/setup/setup-missed-call-rules-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Missed-call trigger rules (spec 09) — cooldown/pause live under Recovery. */
export default function MctbSetupMissedCallRulesPage() {
  if (isNewUiStage2Enabled()) {
    redirect(
      resolveMctbSetupIaRedirect(MCTB_ROUTES.setupMissedCallRules) ??
        `${MCTB_ROUTES.missedCallRecovery}?tab=rules`,
    );
  }
  return <MctbSetupMissedCallRulesView />;
}
