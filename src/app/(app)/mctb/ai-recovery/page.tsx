import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbAiRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import { AiRecoverySettingsPage } from "@/components/mctb/ai-recovery/ai-recovery-settings-page";

export default function MctbAiRecoveryPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbAiRecoveryPage />;
  }
  return <AiRecoverySettingsPage />;
}
