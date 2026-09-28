import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MctbSetupOverview } from "@/components/mctb/setup-overview";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbSetupPage() {
  if (isNewUiStage2Enabled()) {
    redirect(resolveMctbSetupIaRedirect(MCTB_ROUTES.setup) ?? MCTB_ROUTES.missedCallRecovery);
  }
  return <MctbSetupOverview />;
}
