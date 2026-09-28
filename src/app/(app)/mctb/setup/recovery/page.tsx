import { MctbSetupRecoveryView } from "@/components/mctb/setup/setup-recovery-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbSetupRecoveryPage() {
  if (isNewUiStage2Enabled()) {
    redirect(resolveMctbSetupIaRedirect(MCTB_ROUTES.setupRecovery) ?? MCTB_ROUTES.missedCallRecovery);
  }
  return <MctbSetupRecoveryView />;
}
