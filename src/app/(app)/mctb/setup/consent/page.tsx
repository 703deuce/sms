import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MctbSetupConsentView } from "@/components/mctb/setup/setup-consent-view";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default async function MctbSetupConsentPage() {
  if (isNewUiStage2Enabled()) {
    redirect(
      resolveMctbSetupIaRedirect(MCTB_ROUTES.setupConsent) ??
        `${MCTB_ROUTES.missedCallRecovery}?tab=consent`,
    );
  }
  return <MctbSetupConsentView />;
}
