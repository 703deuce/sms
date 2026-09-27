import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbConsentHistoryPage } from "@/newui-transplant/connected/mctb/consent-history-page";
import { MctbConsentLogView } from "@/components/mctb/consent-log-view";

export default function MctbComplianceConsentPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbConsentHistoryPage />;
  }
  return <MctbConsentLogView />;
}
