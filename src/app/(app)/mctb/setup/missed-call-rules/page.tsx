import { MctbSetupMissedCallRulesView } from "@/components/mctb/setup/setup-missed-call-rules-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupMissedCallRulesPage } from "@/newui-transplant/connected/mctb/setup-pages";

/** Missed-call trigger rules (spec 09) — cooldown/pause live under Recovery. */
export default function MctbSetupMissedCallRulesPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupMissedCallRulesPage />;
  }
  return <MctbSetupMissedCallRulesView />;
}
